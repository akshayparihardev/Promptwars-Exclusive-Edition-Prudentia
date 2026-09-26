/**
 * api/analyze_offer_letter.ts
 *
 * Vercel serverless function — the single backend endpoint for Prudentia.
 *
 * Responsibilities:
 *   1. Receives a PDF file as base64 from the client (plus an optional explanation language)
 *   2. Injects relevant statute context from indian_statute_reference.ts deterministically
 *   3. Calls Gemini with native PDF vision (no OCR, no text extraction), trying
 *      each model in GEMINI_MODELS in order until one succeeds
 *   4. Validates the response against the full OfferLetterAnalysis schema (server-side)
 *   5. Returns the validated, typed analysis — or a structured error
 *
 * Storage policy: the PDF is NEVER written to disk or any database.
 *   It is held only in the function's memory for the duration of the single invocation.
 *   Vercel function memory is ephemeral — zeroed between cold starts.
 *
 * Retry policy:
 *   - Benign shape slips (e.g. "key_numbers": null) are normalised without a
 *     second call; anything still schema-invalid gets one automatic retry
 *     with an explicit repair prompt.
 *   - Model-level errors (quota, overload, unavailable): falls back through
 *     GEMINI_MODELS (each has its own daily free-tier quota); if all were
 *     rate-limited, one final backoff-and-retry on the last model. Failing
 *     models are skipped for a cooldown window on warm instances.
 *   If all of that still fails, the error is returned to the client for display.
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
  normaliseAnalysisOutput,
  isPartiallyValid,
  type OfferLetterAnalysis,
} from '../src/logic/analysis_schema_validator.js';
import { INDIAN_STATUTE_REFERENCE } from '../src/data/indian_statute_reference.js';
import { buildStatuteContextForPrompt, type ClauseType } from '../src/logic/clause_to_statute_matcher.js';
import { buildLanguageInstruction, resolveExplanationLanguage } from '../src/logic/explanation_language.js';

// ─── Constants ────────────────────────────────────────────────────────────────

// Tried in order. Google's free-tier quota is keyed per-project-PER-MODEL
// (confirmed from a live 429: quotaId "GenerateRequestsPerDayPerProjectPerModel-
// FreeTier"), so a different model name has its own separate daily allowance -
// falling back to the next model on quota exhaustion is a real mitigation, not
// just a retry against the same wall. All of these support native PDF vision.
//
// IMPORTANT: every ID here was confirmed against this account's live
// GET /v1beta/models list (a free metadata call, no generation quota spent) -
// a previous version of this list included 'gemini-2.0-flash', which does
// NOT exist in this API's current model catalog and would 404, silently
// breaking the fallback chain past whichever model preceded it. Re-verify
// against that endpoint before changing this list again, rather than
// guessing a model name.
//
// Ordered for latency: the Flash-Lite models spend little or no time on
// hidden thinking tokens, so they answer faster than the full flash models,
// which stay in the chain as fallbacks.
const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
];
const MAX_RETRIES = 1;
const MODEL_COOLDOWN_MS = 60000;
const FINAL_RETRY_DELAY_MS = 5000;

// ─── Prompt (built once per cold start, not per request) ──────────────────────

/**
 * The statute context is injected deterministically from INDIAN_STATUTE_REFERENCE —
 * Gemini does not decide which statutes are relevant; the lookup table does.
 *
 * Prompt engineering rationale:
 *   - Statute text is injected BEFORE asking for analysis, so the model reasons from
 *     real law rather than from its training-data approximation of that law.
 *   - The consequence_scenarios structure is explicitly templated with an example
 *     to maximise structural reliability.
 *   - "Assist not replace" language is in the system instruction, not a footer disclaimer.
 */
const STATUTE_BLOCK = Object.entries(INDIAN_STATUTE_REFERENCE)
  .map(([key, entry]) =>
    `[${key}] ${entry.act}, Section ${entry.section} — "${entry.title}"\n` +
    `Text: ${entry.text}\n` +
    `Relevance note: ${entry.relevance_note}`
  )
  .join('\n\n');

const CLAUSE_TYPE_STATUTE_CONTEXT = (
  ['bond', 'non_compete', 'notice_period', 'probation', 'ip_assignment'] as ClauseType[]
)
  .map((ct) => `${ct}: ${buildStatuteContextForPrompt(ct)}`)
  .join('\n\n');

const RETRY_PREFIX =
  'RETRY ATTEMPT: Your previous response was rejected because it did not conform to the required JSON schema. Produce ONLY the JSON object — no markdown fences, no explanatory text, no extra fields.';

const PROMPT_BODY = `You are Prudentia's analysis engine. Your only job is to analyse an Indian employment offer letter and produce a single JSON object conforming exactly to the schema below.

ROLE AND CONSTRAINTS:
- You assist — you do NOT give legal verdicts. Every risk flag must use calibrated language: "may be," "commonly disputed," "worth clarifying with a professional." Never write "this is void" or "you will win."
- concern_rationale MUST reference the applicable Indian law by name — never bare opinion.
- The disclaimer field MUST be present and non-empty in your output. Use: "This analysis is for informational purposes only and does not constitute legal advice. Consult a qualified Indian labour law practitioner before making any decisions."
- If the document is not an offer letter, set is_offer_letter: false, set clauses: [], and explain in document_type.
- exact_quote MUST be verbatim text from the document — do not paraphrase.
- clause_reference MUST be only the clause/section identifier exactly as printed in the document (e.g. "8.2", "4", "3(a)", "Section 3") — not the heading text. Use null if the clause is not numbered — never invent a number.
- page_hint MUST be the 1-indexed page the exact_quote appears on.
- consultation_questions MUST be specific to findings in THIS document — never generic boilerplate.
- If the document is silent on something an employee would reasonably need to know (e.g. stock options, gratuity, leave policy), list it in unanswered_questions rather than guessing.

LENGTH LIMITS (keep the analysis concise — it is read on a phone and must generate quickly):
- At most 8 clauses; if there are more, keep the most consequential ones.
- plain_english: at most 2 short sentences. concern_rationale: at most 3 sentences.
- consequence_scenarios: at most 2 per clause, each with at most 3 short consequence_steps.
- unanswered_questions: at most 5. consultation_questions: at most 6.

STATUTE REFERENCE LIBRARY (use these when assigning applicable_law — do not cite statutes not in this list):
${STATUTE_BLOCK}

CLAUSE TYPE → STATUTE MAPPING:
${CLAUSE_TYPE_STATUTE_CONTEXT}

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
      "clause_reference": "clause/section number as printed, e.g. '8.2'" or null,
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
}`;

const PROMPT_FOOTER = 'Now analyse the attached PDF document and produce the JSON.';

function buildAnalysisPrompt(isRetry: boolean, languageInstruction: string): string {
  return [isRetry ? RETRY_PREFIX : '', PROMPT_BODY, languageInstruction, PROMPT_FOOTER]
    .filter(Boolean)
    .join('\n\n');
}

// ─── Gemini caller ────────────────────────────────────────────────────────────

// Reused across warm invocations of the serverless function instead of being
// re-created per request.
let cachedClient: { apiKey: string; client: GoogleGenerativeAI } | null = null;

function getGeminiClient(apiKey: string): GoogleGenerativeAI {
  if (!cachedClient || cachedClient.apiKey !== apiKey) {
    cachedClient = { apiKey, client: new GoogleGenerativeAI(apiKey) };
  }
  return cachedClient.client;
}

async function callGeminiOnModel(
  genai: GoogleGenerativeAI,
  modelName: string,
  prompt: string,
  pdfBase64: string,
  mimeType: string
): Promise<unknown> {
  // responseMimeType: 'application/json' forces Gemini's native JSON output
  // mode - it can no longer wrap the response in markdown fences, prepend
  // commentary, or otherwise emit non-JSON text before/after the object.
  const model = genai.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const pdfPart: Part = {
    inlineData: {
      data: pdfBase64,
      mimeType: mimeType as 'application/pdf',
    },
  };

  const result = await model.generateContent([{ text: prompt }, pdfPart]);
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

/**
 * Errors that are about one specific model rather than the request: quota
 * exhaustion (429), the model being overloaded or failing internally (503/500),
 * or not being available to this key (404). Another model may well succeed.
 * JSON parse failures and network errors are deliberately excluded — they are
 * not model-specific and are handled by the caller's repair/error paths.
 */
function isModelLevelError(err: unknown): boolean {
  if (isRateLimitError(err)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  return status === 404 || status === 500 || status === 503 || /\[(?:404|500|503)\b|overloaded|not found for API/i.test(msg);
}

// Models that recently failed at the model level are skipped until their
// cooldown expires, so a warm instance doesn't spend a round-trip on a model
// it already knows is exhausted or unavailable.
const modelCooldownUntil = new Map<string, number>();

/**
 * Tries each available model in GEMINI_MODELS in order. A model-level failure
 * (quota, overload, unavailable) puts that model on cooldown and moves
 * immediately to the next — a different model has its own quota bucket and
 * capacity, so no backoff is needed. Any other error is rethrown immediately
 * without burning the remaining models' quota. If every candidate was
 * rate-limited, one last bounded backoff-and-retry is attempted before giving up.
 */
async function callGeminiWithFallback(
  genai: GoogleGenerativeAI,
  prompt: string,
  pdfBase64: string,
  mimeType: string
): Promise<unknown> {
  const now = Date.now();
  const ready = GEMINI_MODELS.filter((model) => (modelCooldownUntil.get(model) ?? 0) <= now);
  const candidates = ready.length > 0 ? ready : GEMINI_MODELS;
  let lastError: unknown;

  for (const modelName of candidates) {
    try {
      const output = await callGeminiOnModel(genai, modelName, prompt, pdfBase64, mimeType);
      modelCooldownUntil.delete(modelName);
      return output;
    } catch (err) {
      if (!isModelLevelError(err)) throw err;
      lastError = err;
      modelCooldownUntil.set(modelName, Date.now() + MODEL_COOLDOWN_MS);
    }
  }

  // A short wait only helps a short-lived per-minute rate-limit burst.
  if (!isRateLimitError(lastError)) throw lastError;
  await sleep(FINAL_RETRY_DELAY_MS);
  return callGeminiOnModel(genai, candidates[candidates.length - 1], prompt, pdfBase64, mimeType);
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
  const { pdf_base64, mime_type, language } = req.body as {
    pdf_base64?: string;
    mime_type?: string;
    language?: unknown;
  };

  if (!pdf_base64 || typeof pdf_base64 !== 'string') {
    res.status(400).json({ error: 'Missing or invalid pdf_base64 field in request body.' });
    return;
  }

  const resolvedMimeType = mime_type ?? 'application/pdf';
  // Untrusted input: anything not on the allow-list falls back to English.
  const languageInstruction = buildLanguageInstruction(resolveExplanationLanguage(language));
  const prompt = buildAnalysisPrompt(false, languageInstruction);
  const repairPrompt = buildAnalysisPrompt(true, languageInstruction);

  // Validate API key
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY not set.' });
    return;
  }

  const genai = getGeminiClient(apiKey);

  // ─── Attempt 1 ─────────────────────────────────────────────────────────────
  let rawOutput: unknown;

  try {
    rawOutput = await callGeminiWithFallback(genai, prompt, pdf_base64, resolvedMimeType);
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
        rawOutput = await callGeminiWithFallback(genai, repairPrompt, pdf_base64, resolvedMimeType);
      } catch (retryError) {
        res.status(502).json({
          error: 'Gemini returned unparseable output on both attempts.',
          detail: retryError instanceof Error ? retryError.message : String(retryError),
        });
        return;
      }
    } else if (isRateLimitError(parseOrNetworkError)) {
      // Every model in GEMINI_MODELS (plus the final backoff retry inside
      // callGeminiWithFallback) was rate-limited - a genuine full exhaustion,
      // not something a quick retry can fix.
      res.status(429).json({
        error: "Gemini's API rate limit was reached across all available models. Please wait about a minute and try again.",
        detail: msg,
      });
      return;
    } else {
      res.status(502).json({
        error: 'Failed to call Gemini API.',
        detail: msg,
      });
      return;
    }
  }

  // ─── Schema validation ──────────────────────────────────────────────────────
  rawOutput = normaliseAnalysisOutput(rawOutput);
  let validationResult = validateAnalysisOutput(rawOutput);

  if (!validationResult.valid) {
    // Attempt repair if the output is partially valid (has clauses array)
    if (isPartiallyValid(rawOutput) && MAX_RETRIES > 0) {
      try {
        const retryOutput = normaliseAnalysisOutput(
          await callGeminiWithFallback(genai, repairPrompt, pdf_base64, resolvedMimeType)
        );
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
        // `in` narrowing rather than relying on the `valid` discriminant: Vercel's
        // function compiler has failed to narrow ValidationResult here before.
        validation_errors: 'errors' in validationResult ? validationResult.errors : [],
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
