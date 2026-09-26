/**
 * use_document_analysis.ts
 *
 * React hook that manages the full document analysis lifecycle:
 *   1. Accepts a PDF File object from the upload screen
 *   2. Converts it to base64 for the API call
 *   3. Calls the /api/analyze_offer_letter endpoint
 *   4. Manages loading, error, and success states
 *   5. Handles Q&A against the returned analysis
 *
 * This hook is the single source of truth for analysis state in the app.
 * All components that need analysis data consume this hook.
 */

import { useState, useCallback } from 'react';
import type { OfferClause, OfferLetterAnalysis } from '../logic/analysis_schema_validator.js';
import { buildNotAddressedResult, verifyQuoteInDocument } from '../logic/document_quote_verifier.js';
import type { QuoteVerificationResult } from '../logic/document_quote_verifier.js';
import { formatSourceLocation } from '../logic/clause_reference_formatter.js';
import { DEFAULT_LANGUAGE } from '../logic/explanation_language.js';

// ── State types ──────────────────────────────────────────────────────────────

export type AnalysisPhase =
  | 'idle'           // No document uploaded yet
  | 'uploading'      // Converting file to base64
  | 'analyzing'      // Waiting for Gemini response
  | 'validating'     // Running schema validation
  | 'complete'       // Analysis ready to display
  | 'error';         // Something went wrong

export interface AnalysisError {
  message: string;
  validation_errors?: string[];
  is_retryable: boolean;
}

export interface QAEntry {
  question: string;
  answer: string | null;
  quote_verification: QuoteVerificationResult | null;
  /** 'answered' | 'not_addressed_in_document' | 'processing' */
  qa_status: 'answered' | 'not_addressed_in_document' | 'processing';
  timestamp: number;
}

export interface UseDocumentAnalysisReturn {
  /** Current phase of the analysis lifecycle. */
  phase: AnalysisPhase;
  /** The validated analysis result. Only populated when phase === 'complete'. */
  analysis: OfferLetterAnalysis | null;
  /** Error details. Only populated when phase === 'error'. */
  error: AnalysisError | null;
  /** Name of the file currently being analyzed. */
  fileName: string | null;
  /** Q&A history for this analysis session. */
  qaHistory: QAEntry[];
  /** Full text independently extracted from the PDF using PDF.js. */
  extractedPdfText: string;
  /** The original File object uploaded. */
  originalFile: File | null;
  /** Triggers a new analysis for the given file, with explanations in the given language code. */
  analyzeDocument: (file: File, languageCode?: string) => Promise<void>;
  /** Asks a question against the current analysis. */
  askQuestion: (question: string) => void;
  /** Resets to idle state, clearing all results. */
  reset: () => void;
}

// ── Helper: file to base64 ───────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to extract base64 from file'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('FileReader error: ' + reader.error?.message));
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts the PDF's text independently with PDF.js. Never rejects: on failure
 * it resolves to '' and quote verification falls back to the quoted clauses.
 * pdfjs-dist is dynamically imported so it stays out of the main bundle.
 */
function extractPdfText(file: File): Promise<string> {
  return import('../logic/pdf_text_extractor.js')
    .then(({ extractTextFromPdf }) => extractTextFromPdf(file))
    .then((extraction) => extraction.fullText)
    .catch(() => {
      console.warn('[Prudentia] PDF.js text extraction failed');
      return '';
    });
}

// ── Q&A against the analysis ─────────────────────────────────────────────────

/**
 * Broad synonym map per clause type: legal terms, casual employee phrasings,
 * and paraphrases a judge or job-seeker would actually type. This prevents
 * false not_addressed_in_document on obvious near-misses.
 */
const CLAUSE_KEYWORDS: Record<string, string[]> = {
  bond: [
    'bond', 'training bond', 'service bond', 'commitment period',
    'lock-in', 'lock in', 'locked in', 'minimum tenure', 'mandatory period',
    'recovery', 'reclaim', 'clawback', 'repay', 'pay back',
    'leave early', 'quit early', 'resign early', 'break the bond',
    'penalty for leaving', 'penalty for resignation', 'bond amount',
  ],
  non_compete: [
    'non-compete', 'non compete', 'noncompete', 'restraint', 'competition',
    'competing company', 'join competitor', 'work elsewhere', 'work for another',
    'restriction after leaving', 'post-employment', 'post employment',
    'restraint of trade', 'exclusivity', 'restricted from working',
    'other company', 'rival company',
  ],
  notice_period: [
    'notice period', 'notice', 'resignation notice', 'termination notice',
    'how long to resign', 'days to resign', 'weeks notice', 'months notice',
    'serving notice', 'gardening leave', 'leave without notice',
    'let go', 'fired', 'terminated', 'dismissed', 'laid off', 'sacked',
    'exit', 'quitting', 'how long before i can leave',
    'how many days', 'how many weeks', 'how many months to leave',
  ],
  probation: [
    'probation', 'probationary', 'trial period', 'on trial', 'probation period',
    'during probation', 'in probation', 'while on probation',
    'get let go during', 'fired during', 'terminated during', 'dismissed during',
    'first few months', 'initial period', 'assessment period', 'confirmation',
  ],
  ip_assignment: [
    'intellectual property', 'ip', 'copyright', 'invention', 'patent',
    'who owns my work', 'ownership of work', 'my code', 'my design',
    'side project', 'personal project', 'work i made', 'invention assignment',
    'assignment of rights', 'transfer of rights', 'work product',
  ],
};

/** Words too generic to signal which clause a free-text question is about. */
const STOPWORDS = new Set([
  'what', 'when', 'does', 'will', 'this', 'that', 'with', 'have', 'from',
  'about', 'there', 'which', 'happen', 'happens', 'document', 'letter',
  'offer', 'clause', 'section', 'stated', 'says', 'said',
]);

type QAResult = { answer: string | null; status: QAEntry['qa_status']; verification: QuoteVerificationResult | null };

/** Answers from a clause, citing where it sits in the document (e.g. "Clause 2 · Page 1"). */
function answerFromClause(clause: OfferClause, documentText: string): QAResult {
  const location = formatSourceLocation(clause.clause_reference, clause.page_hint);
  const quoteLabel = location ? `Direct quote from document (${location})` : 'Direct quote from document';
  return {
    answer: `${clause.plain_english}\n\n${quoteLabel}: "${clause.exact_quote}"\n\nConcern: ${clause.concern_rationale}`,
    status: 'answered',
    verification: verifyQuoteInDocument(clause.exact_quote, documentText),
  };
}

function notAddressed(question: string): QAResult {
  return { answer: null, status: 'not_addressed_in_document', verification: buildNotAddressedResult(question) };
}

/**
 * Attempts to answer a question from the current analysis result.
 * This is a local, deterministic search — no additional AI call.
 *
 * Strategy:
 *   1. Check if the question matches a known clause type via broad synonym coverage
 *   2. If yes, find the matching clause and return its plain_english + exact_quote
 *   3. Check offer_summary fields (CTC, joining date, company, role)
 *   4. Scan every extracted clause for keyword overlap
 *   5. If not found anywhere, mark as not_addressed_in_document
 */
function answerFromAnalysis(question: string, analysis: OfferLetterAnalysis, documentText: string): QAResult {
  const q = question.toLowerCase();

  const matchedClauseType = Object.keys(CLAUSE_KEYWORDS).find((clauseType) =>
    CLAUSE_KEYWORDS[clauseType].some((kw) => q.includes(kw))
  );

  if (matchedClauseType) {
    const clause = analysis.clauses.find((c) => c.clause_type === matchedClauseType);
    // Keyword matched a clause type but that clause was not found in this document
    return clause ? answerFromClause(clause, documentText) : notAddressed(question);
  }

  // Check offer_summary fields
  if (q.includes('ctc') || q.includes('salary') || q.includes('compensation') ||
      q.includes('pay') || q.includes('package') || q.includes('lpa') || q.includes('lakh')) {
    if (analysis.offer_summary.ctc) {
      return { answer: `CTC stated in offer: ${analysis.offer_summary.ctc}`, status: 'answered', verification: null };
    }
  }

  if (q.includes('joining') || q.includes('start date') || q.includes('join from') ||
      q.includes('when do i start') || q.includes('date of joining')) {
    if (analysis.offer_summary.joining_date) {
      return { answer: `Joining date stated in offer: ${analysis.offer_summary.joining_date}`, status: 'answered', verification: null };
    }
  }

  if (q.includes('company') || q.includes('employer') || q.includes('organisation') || q.includes('organization')) {
    if (analysis.offer_summary.company) {
      return { answer: `Company: ${analysis.offer_summary.company}`, status: 'answered', verification: null };
    }
  }

  if (q.includes('role') || q.includes('designation') || q.includes('position') ||
      q.includes('job title') || q.includes('title')) {
    if (analysis.offer_summary.role) {
      return { answer: `Role: ${analysis.offer_summary.role}`, status: 'answered', verification: null };
    }
  }

  // Generic fallback: scan every extracted clause (including 'general' —
  // clauses outside the 5 named categories, e.g. ESOP/stock-option clauses)
  // for keyword overlap before giving up. Without this, a clause that was
  // genuinely found and extracted could still be wrongly reported as
  // "not enough information" just because it doesn't match one of the
  // fixed categories above.
  const questionWords = q
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

  if (questionWords.length > 0) {
    const clause = analysis.clauses.find((c) => {
      const haystack = `${c.title} ${c.plain_english} ${c.exact_quote}`.toLowerCase();
      return questionWords.some((w) => haystack.includes(w));
    });
    if (clause) return answerFromClause(clause, documentText);
  }

  return notAddressed(question);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDocumentAnalysis(): UseDocumentAnalysisReturn {
  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [analysis, setAnalysis] = useState<OfferLetterAnalysis | null>(null);
  const [error, setError] = useState<AnalysisError | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [qaHistory, setQaHistory] = useState<QAEntry[]>([]);
  const [extractedPdfText, setExtractedPdfText] = useState<string>('');

  const analyzeDocument = useCallback(async (file: File, languageCode: string = DEFAULT_LANGUAGE.code) => {
    setPhase('uploading');
    setError(null);
    setAnalysis(null);
    setQaHistory([]);
    setExtractedPdfText('');
    setFileName(file.name);
    setOriginalFile(file);

    // Independent client-side text extraction runs in parallel with the API
    // call (it doesn't depend on it) and is only awaited once results arrive,
    // so it adds no time to the wait.
    const pdfTextPromise = extractPdfText(file);

    let pdfBase64: string;
    try {
      pdfBase64 = await fileToBase64(file);
    } catch (err) {
      setPhase('error');
      setError({
        message: `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
        is_retryable: true,
      });
      return;
    }

    setPhase('analyzing');

    let rawResponse: Response;
    try {
      rawResponse = await fetch('/api/analyze_offer_letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_base64: pdfBase64,
          mime_type: file.type || 'application/pdf',
          language: languageCode,
        }),
      });
    } catch (networkErr) {
      setPhase('error');
      setError({
        message: `Network error: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`,
        is_retryable: true,
      });
      return;
    }

    setPhase('validating');

    let responseData: unknown;
    try {
      responseData = await rawResponse.json();
    } catch {
      setPhase('error');
      setError({
        message: 'Server returned an unreadable response. Please try again.',
        is_retryable: true,
      });
      return;
    }

    if (!rawResponse.ok) {
      const errorData = responseData as {
        error?: string;
        validation_errors?: string[];
      };
      setPhase('error');
      setError({
        message: errorData.error ?? `Server error (${rawResponse.status})`,
        validation_errors: errorData.validation_errors,
        is_retryable: rawResponse.status >= 500 || rawResponse.status === 429,
      });
      return;
    }

    // Quote verification needs the independently extracted text, so set it
    // together with the analysis rather than letting results render without it.
    setExtractedPdfText(await pdfTextPromise);
    setAnalysis(responseData as OfferLetterAnalysis);
    setPhase('complete');
  }, []);

  const askQuestion = useCallback(
    (question: string) => {
      if (!analysis || phase !== 'complete') return;

      // Add a processing placeholder immediately for responsive UX
      const entry: QAEntry = {
        question,
        answer: null,
        quote_verification: null,
        qa_status: 'processing',
        timestamp: Date.now(),
      };
      setQaHistory((prev) => [...prev, entry]);

      // Answer synchronously from the existing analysis (no extra AI call)
      const { answer, status, verification } = answerFromAnalysis(question, analysis, extractedPdfText);

      setQaHistory((prev) =>
        prev.map((e) =>
          e.timestamp === entry.timestamp
            ? { ...e, answer, quote_verification: verification, qa_status: status }
            : e
        )
      );
    },
    [analysis, phase, extractedPdfText]
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setAnalysis(null);
    setError(null);
    setFileName(null);
    setOriginalFile(null);
    setQaHistory([]);
    setExtractedPdfText('');
  }, []);

  return {
    phase,
    analysis,
    error,
    fileName,
    originalFile,
    qaHistory,
    extractedPdfText,
    analyzeDocument,
    askQuestion,
    reset,
  };
}
