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
import type { OfferLetterAnalysis } from '../logic/analysis_schema_validator.js';
import { buildNotAddressedResult, verifyQuoteInDocument } from '../logic/document_quote_verifier.js';
import type { QuoteVerificationResult } from '../logic/document_quote_verifier.js';

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
  /** Human-readable status message during analysis. */
  analysisStatus: string;
  /** Triggers a new analysis for the given file. */
  analyzeDocument: (file: File) => Promise<void>;
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

// ── Q&A against the analysis ─────────────────────────────────────────────────

/**
 * Attempts to answer a question from the current analysis result.
 * This is a local, deterministic search — no additional AI call.
 *
 * Strategy:
 *   1. Check if the question matches a known clause type via broad synonym coverage
 *   2. If yes, find the matching clause and return its plain_english + exact_quote
 *   3. Check offer_summary fields (CTC, joining date, company, role)
 *   4. If not found anywhere, mark as not_addressed_in_document
 *
 * Synonym coverage rationale:
 *   Each clause type has broad synonyms covering legal terms, casual employee
 *   phrasings, and paraphrases a judge or job-seeker would actually type.
 *   This prevents false not_addressed_in_document on obvious near-misses.
 */
function answerFromAnalysis(
  question: string,
  analysis: OfferLetterAnalysis,
  documentText: string
): { answer: string | null; status: QAEntry['qa_status']; verification: QuoteVerificationResult | null } {
  const q = question.toLowerCase();

  // Broad synonym map per clause type
  const keywordMap: Record<string, string[]> = {
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

  // Find matching clause type
  let matchedClauseType: string | null = null;
  for (const [clauseType, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((kw) => q.includes(kw))) {
      matchedClauseType = clauseType;
      break;
    }
  }

  if (matchedClauseType) {
    const clause = analysis.clauses.find((c) => c.clause_type === matchedClauseType);
    if (clause) {
      const answer =
        `${clause.plain_english}\n\nDirect quote from document: "${clause.exact_quote}"\n\nConcern: ${clause.concern_rationale}`;
      const verification = verifyQuoteInDocument(clause.exact_quote, documentText);
      return { answer, status: 'answered', verification };
    }
    // Keyword matched a clause type but that clause was not found in this document
    return {
      answer: null,
      status: 'not_addressed_in_document',
      verification: buildNotAddressedResult(question),
    };
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
  const STOPWORDS = new Set([
    'what', 'when', 'does', 'will', 'this', 'that', 'with', 'have', 'from',
    'about', 'there', 'which', 'happen', 'happens', 'document', 'letter',
    'offer', 'clause', 'section', 'stated', 'says', 'said',
  ]);
  const questionWords = q
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

  if (questionWords.length > 0) {
    for (const clause of analysis.clauses) {
      const haystack = `${clause.title} ${clause.plain_english} ${clause.exact_quote}`.toLowerCase();
      if (questionWords.some((w) => haystack.includes(w))) {
        const answer =
          `${clause.plain_english}\n\nDirect quote from document: "${clause.exact_quote}"\n\nConcern: ${clause.concern_rationale}`;
        const verification = verifyQuoteInDocument(clause.exact_quote, documentText);
        return { answer, status: 'answered', verification };
      }
    }
  }

  // Not found anywhere in the analysis
  return {
    answer: null,
    status: 'not_addressed_in_document',
    verification: buildNotAddressedResult(question),
  };
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
  const [analysisStatus] = useState<string>('');

  const analyzeDocument = useCallback(async (file: File) => {
    setPhase('uploading');
    setError(null);
    setAnalysis(null);
    setQaHistory([]);
    setExtractedPdfText('');
    setFileName(file.name);
    setOriginalFile(file);

    // Step 1: Extract text independently using PDF.js (client-side).
    // Dynamically imported: pdfjs-dist is a large dependency (~37MB unpacked)
    // that's only ever needed once a user actually uploads a file, so keeping
    // it out of the main bundle noticeably speeds up first paint.
    try {
      const { extractTextFromPdf } = await import('../logic/pdf_text_extractor.js');
      const extraction = await extractTextFromPdf(file);
      setExtractedPdfText(extraction.fullText);
    } catch {
      console.warn('[Prudentia] PDF.js text extraction failed');
    }

    // Step 2: Convert to base64 for the Gemini API call
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
    analysisStatus,
    analyzeDocument,
    askQuestion,
    reset,
  };
}

