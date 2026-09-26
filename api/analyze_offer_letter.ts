/**
 * api/analyze_offer_letter.ts
 *
 * Vercel serverless function — the single backend endpoint for Prudentia.
 *
 * Responsibilities:
 *   1. Receives a PDF file as base64 from the client
 *   2. Determines which clause types are present (pre-analysis step)
 *   3. Injects relevant statute context from indian_statute_reference.ts deterministically
 *   4. Calls Gemini 2.5 Flash with native PDF vision (no OCR, no text extraction)
 *   5. Validates the response against the full OfferLetterAnalysis schema (server-side)
 *   6. Returns the validated, typed analysis — or a structured error
 *
 * Storage policy: the PDF is NEVER written to disk or any database.
 *   It is held only in the function's memory for the duration of the single invocation.
 *   Vercel function memory is ephemeral — zeroed between cold starts.
 *
 * Retry policy: if Gemini produces schema-invalid output, one automatic retry is made
 *   with an explicit repair prompt. If the retry also fails validation, the error is
 *   returned to the client for user-facing display.
 *
 * "Assist not replace" enforcement:
 *   - The system prompt explicitly prohibits legal conclusions stated as fact.
 *   - The disclaimer field is required in the schema — if Gemini omits it, validation fails.
 *   - concern_rationale must reference applicable law, not bare opinion — enforced by prompt.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import {
  validateAnalysisOutput,
  isPartiallyValid,
  type OfferLetterAnalysis,
} from '../src/logic/analysis_schema_validator.js';
import { INDIAN_STATUTE_REFERENCE } from '../src/data/indian_statute_reference.js';
import { buildStatuteContextForPrompt, type ClauseType } from '../src/logic/clause_to_statute_matcher.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 1;

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds the full system + user prompt sent to Gemini.
 * The statute context is injected deterministically from INDIAN_STATUTE_REFERENCE —
 * Gemini does not decide which statutes are relevant; the lookup table does.
 *
 * Prompt engineering rationale:
 *   - Statute text is injected BEFORE asking for analysis, so the model reasons from
 *     real law rather than from its training-data approximation of that law.
 *   - The consequence_scenarios structure is explicitly templated with an example
 *     to maximise structural reliability (Step 6 test validates this).
 *   - "Assist not replace" language is in the system instruction, not a footer disclaimer.
 */
function buildAnalysisPrompt(isRetry = false): string {
  // Build the full statute reference block for injection into the prompt
  const statuteBlock = Object.entries(INDIAN_STATUTE_REFERENCE as Record<string, any>)
    .map(([key, entry]) => {
      return (
        `[${key}] ${entry.act}, Section ${entry.section} — "${entry.title}"\n` +
        `Text: ${entry.text}\n` +
        `Relevance note: ${entry.relevance_note}`
      );
    })
    .join('\n\n');

  const clauseTypeStatuteContext = (
    ['bond', 'non_compete', 'notice_period', 'probation', 'ip_assignment'] as ClauseType[]
  )
    .map((ct) => `${ct}: ${buildStatuteContextForPrompt(ct)}`)
    .join('\n\n');

  const retryPrefix = isRetry
    ? 'RETRY ATTEMPT: Your previous response was rejected because it did not conform to the required JSON schema. Produce ONLY the JSON object — no markdown fences, no explanatory text, no extra fields.\n\n'
    : '';

  return `${retryPrefix}You are Prudentia's analysis engine. Your only job is to analyse an Indian employment offer letter and produce a single JSON object conforming exactly to the schema below.

ROLE AND CONSTRAINTS:
- You assist — you do NOT give legal verdicts. Every risk flag must use calibrated language: "may be," "commonly disputed," "worth clarifying with a professional." Never write "this is void" or "you will win."
- concern_rationale MUST reference the applicable Indian law by name — never bare opinion.
- The disclaimer field MUST be present and non-empty in your output. Use: "This analysis is for informational purposes only and does not constitute legal advice. Consult a qualified Indian labour law practitioner before making any decisions."
- If the document is not an offer letter, set is_offer_letter: false, set clauses: [], and explain in document_type.
- exact_quote MUST be verbatim text from the document — do not paraphrase.
- consultation_questions MUST be specific to findings in THIS document — never generic boilerplate.

STATUTE REFERENCE LIBRARY (use these when assigning applicable_law — do not cite statutes not in this list):
${statuteBlock}

CLAUSE TYPE → STATUTE MAPPING:
${clauseTypeStatuteContext}

KEY DISTINCTION FOR NON-COMPETE (ICA Section 27):
- Restraints operating ONLY during active employment: generally valid, concern_level: 'minor'  
- Restraints continuing AFTER employment ends: typically void, concern_level: 'significant'
- Always specify which scenario applies in concern_rationale.

KEY DISTINCTION FOR BOND PENALTIES (ICA Sections 73 & 74):
- Indian courts assess "reasonable compensation" — the stated penalty amount is a ceiling, not automatic.
- Include this nuance in the consequence_scenarios for bond clauses.

consequence_scenarios STRUCTURE — follow this template exactly:
{
  "trigger": "string describing what event/action triggers this scenario",
  "consequence_steps": ["step 1 that happens", "step 2 that follows", "step 3 resolution"],
  "financial_estimate": "string like '₹50,000–₹1,50,000 (court may award less under ICA §74)' or null if not applicable",
  "outcome_likelihood": "probable" | "possible" | "uncertain"
}

REQUIRED JSON SCHEMA — output ONLY this object, no markdown, no code fences:
{
  "document_type": "string",
  "is_offer_letter": boolean,
  "offer_summary": {
    "company": "string or null",
    "role": "string or null",
    "ctc": "string or null",
    "joining_date": "string or null"
  },
  "clauses": [
    {
      "id": "unique string like 'clause_1'",
      "clause_type": "bond" | "non_compete" | "notice_period" | "probation" | "ip_assignment" | "general",
      "title": "short human-readable title",
      "plain_english": "1-3 sentence plain language explanation",
      "exact_quote": "verbatim text from document",
      "page_hint": number or null,
      "concern_level": "minor" | "moderate" | "significant",
      "concern_rationale": "explanation referencing specific applicable law",
      "key_numbers": {
        "duration_months": number or null,
        "amount_inr": number or null,
        "notice_days": number or null
      },
      "applicable_law": [{ "act": "string", "section": "string" }],
      "consequence_scenarios": [
        {
          "trigger": "string",
          "consequence_steps": ["string", "string"],
          "financial_estimate": "string or null",
          "outcome_likelihood": "probable" | "possible" | "uncertain"
        }
      ]
    }
  ],
  "unanswered_questions": ["string"],
  "consultation_questions": ["specific question about this document"],
  "overall_concern_level": "minor" | "moderate" | "significant",
  "disclaimer": "This analysis is for informational purposes only..."
}

Now analyse the attached PDF document and produce the JSON.`;
}

// ─── Gemini caller ────────────────────────────────────────────────────────────

async function callGemini(
  genai: GoogleGenerativeAI,
  pdfBase64: string,
  mimeType: string,
  isRetry: boolean
): Promise<unknown> {
  const model = genai.getGenerativeModel({ model: GEMINI_MODEL });

  const pdfPart: Part = {
    inlineData: {
      data: pdfBase64,
      mimeType: mimeType as 'application/pdf',
    },
  };

  const textPart: Part = {
    text: buildAnalysisPrompt(isRetry),
  };

  const result = await model.generateContent([textPart, pdfPart]);
  const responseText = result.response.text();

  // Strip markdown code fences if Gemini wraps output despite being told not to
  const cleaned = responseText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detects Google Generative AI rate-limit / quota-exhaustion errors.
 * The SDK surfaces these as HTTP 429 with a message containing
 * "RESOURCE_EXHAUSTED" or "quota" - distinct from a genuine network
 * failure or an invalid/misconfigured key, which need different
 * messaging so the user knows whether to retry immediately or wait.
 */
function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  return status === 429 || /RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(msg);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', process.env['VITE_APP_URL'] ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Parse request body
  const { pdf_base64, mime_type } = req.body as {
    pdf_base64?: string;
    mime_type?: string;
  };

  if (!pdf_base64 || typeof pdf_base64 !== 'string') {
    res.status(400).json({ error: 'Missing or invalid pdf_base64 field in request body.' });
    return;
  }

  const resolvedMimeType = mime_type ?? 'application/pdf';

  // Validate API key
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY not set.' });
    return;
  }

  const genai = new GoogleGenerativeAI(apiKey);

  // ─── Attempt 1 ─────────────────────────────────────────────────────────────
  let rawOutput: unknown;

  try {
    rawOutput = await callGemini(genai, pdf_base64, resolvedMimeType, false);
  } catch (parseOrNetworkError) {
    const msg =
      parseOrNetworkError instanceof Error
        ? parseOrNetworkError.message
        : String(parseOrNetworkError);

    if (msg.includes('JSON')) {
      // JSON parse failure - Gemini's own output was malformed. Retry with
      // an explicit repair prompt (this is a formatting issue, not a
      // transient/rate-limit issue, so no backoff needed).
      try {
        rawOutput = await callGemini(genai, pdf_base64, resolvedMimeType, true);
      } catch (retryError) {
        res.status(502).json({
          error: 'Gemini returned unparseable output on both attempts.',
          detail: retryError instanceof Error ? retryError.message : String(retryError),
        });
        return;
      }
    } else if (isRateLimitError(parseOrNetworkError)) {
      // Rate limit / quota exhaustion - a fresh call an instant later is
      // very likely to hit the exact same wall, so wait briefly before the
      // one retry we can afford within the function's time budget.
      await sleep(5000);
      try {
        rawOutput = await callGemini(genai, pdf_base64, resolvedMimeType, false);
      } catch (retryError) {
        const stillRateLimited = isRateLimitError(retryError);
        res.status(429).json({
          error: stillRateLimited
            ? "Gemini's API rate limit was reached (too many requests in a short time). Please wait about a minute and try again."
            : 'Failed to call Gemini API.',
          detail: retryError instanceof Error ? retryError.message : String(retryError),
        });
        return;
      }
    } else {
      res.status(502).json({
        error: 'Failed to call Gemini API.',
        detail: msg,
      });
      return;
    }
  }

  // ─── Schema validation ──────────────────────────────────────────────────────
  let validationResult = validateAnalysisOutput(rawOutput);

  if (!validationResult.valid) {
    // Attempt repair if the output is partially valid (has clauses array)
    if (isPartiallyValid(rawOutput) && MAX_RETRIES > 0) {
      try {
        const retryOutput = await callGemini(genai, pdf_base64, resolvedMimeType, true);
        validationResult = validateAnalysisOutput(retryOutput);
        if (validationResult.valid) {
          rawOutput = retryOutput;
        }
      } catch {
        // Retry failed — fall through to return validation errors
      }
    }

    if (!validationResult.valid) {
      res.status(422).json({
        error: 'Gemini output did not conform to the required analysis schema.',
        validation_errors: (validationResult as any).errors,
        raw_output_preview:
          JSON.stringify(rawOutput)?.slice(0, 500) ?? '(unparseable)',
      });
      return;
    }
  }

  // ─── Success ────────────────────────────────────────────────────────────────
  const analysis: OfferLetterAnalysis = validationResult.data;
  res.status(200).json(analysis);
}
