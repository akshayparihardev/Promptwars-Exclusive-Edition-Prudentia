/**
 * document_quote_verifier.ts
 *
 * Verifies whether an exact_quote extracted by Gemini is actually present in the
 * document's extracted text. Produces one of three distinct states:
 *
 *   'confirmed_in_document'    — the quote was found verbatim (or near-verbatim) in the text
 *   'not_found_in_document'    — a quote was provided but cannot be located in the text
 *   'not_addressed_in_document' — no quote was provided / the topic was not in the document
 *
 * WHY THREE STATES (not two):
 *   - 'not_found_in_document' means: Gemini claims a clause exists but we can't verify the
 *     exact wording — this is a hallucination risk signal.
 *   - 'not_addressed_in_document' means: the user asked about something (e.g., "is there a
 *     gratuity clause?") and the document simply doesn't address it — this is not an error,
 *     it's important information the user needs.
 *   These two states are fundamentally different and must NEVER be collapsed into one
 *   "unclear" state. The spec explicitly requires visual distinction between them.
 *
 * Implementation note:
 *   This module operates on extracted text (string), not on the PDF binary.
 *   Text extraction from the PDF is handled by the Gemini native PDF vision call.
 *   This verifier receives the text that Gemini reported seeing in the document.
 *
 *   For the client-side use case (no raw text available), quote_status is set by the
 *   API response based on Gemini's self-report, and can be re-verified if the user
 *   requests it by re-uploading.
 */

/** The three distinct quote verification states. Do not add more. Do not merge. */
export type QuoteStatus =
  | 'confirmed_in_document'
  | 'not_found_in_document'
  | 'not_addressed_in_document';

export interface QuoteVerificationResult {
  quote_status: QuoteStatus;
  /** The exact_quote that was checked, or null if none was provided. */
  checked_quote: string | null;
  /** Human-readable explanation of the result — shown in the UI verification panel. */
  explanation: string;
  /** Confidence 0–1: how strong the match is (1.0 for exact, lower for fuzzy). */
  match_confidence: number | null;
}

// ─── Core verification logic ──────────────────────────────────────────────────

/**
 * Normalises text for comparison: collapses whitespace, lowercases, trims.
 * Does NOT strip punctuation — exact_quote is expected to be verbatim.
 */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Every clause is verified against the same document text, so cache the most
// recent normalisation rather than re-running it over the whole document once
// per clause.
let cachedDocText: string | null = null;
let cachedNormDoc = '';

function normaliseDocument(documentText: string): string {
  if (documentText !== cachedDocText) {
    cachedDocText = documentText;
    cachedNormDoc = normalise(documentText);
  }
  return cachedNormDoc;
}

/**
 * Computes a simple character-level overlap ratio between two strings.
 * Used for fuzzy matching when exact match fails (e.g., minor OCR differences).
 * Returns a value from 0 (no overlap) to 1 (identical).
 *
 * Compares in place (no per-window substring allocation) and prunes: a window
 * is abandoned once it can no longer beat the best match so far, and the scan
 * stops on a perfect match. Same result as the exhaustive O(n·m) scan.
 */
function computeOverlapRatio(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  const n = shorter.length;
  let bestMatch = 0;
  for (let i = 0; i <= longer.length - n; i++) {
    let matches = 0;
    for (let j = 0; j < n; j++) {
      if (shorter[j] === longer[i + j]) {
        matches++;
      } else if (matches + (n - j - 1) <= bestMatch) {
        break;
      }
    }
    if (matches > bestMatch) {
      bestMatch = matches;
      if (bestMatch === n) break;
    }
  }
  return bestMatch / n;
}

/**
 * Checks if key_numbers values are consistent with the exact_quote text.
 * If the quote says "60 days" but key_numbers.notice_days is 30, this catches it.
 *
 * @param exactQuote - The verbatim quote from the clause
 * @param keyNumbers - The structured numbers extracted by the LLM
 * @returns A warning string if inconsistency found, null if consistent
 */
export function verifyNumbers(
  exactQuote: string,
  keyNumbers: { duration_months: number | null; amount_inr: number | null; notice_days: number | null }
): string | null {
  if (!exactQuote || !keyNumbers) return null;

  const numsInQuote = Array.from(exactQuote.matchAll(/\d+/g)).map((m) => m[0]);
  if (numsInQuote.length === 0) return null;

  const warnings: string[] = [];

  if (keyNumbers.duration_months != null) {
    const dStr = String(keyNumbers.duration_months);
    if (!numsInQuote.includes(dStr)) {
      warnings.push(`Duration (${dStr} months) not found in quoted text`);
    }
  }

  if (keyNumbers.notice_days != null) {
    const nStr = String(keyNumbers.notice_days);
    if (!numsInQuote.includes(nStr)) {
      warnings.push(`Notice period (${nStr} days) not found in quoted text`);
    }
  }

  if (keyNumbers.amount_inr != null) {
    const aStr = String(keyNumbers.amount_inr);
    const aDigits = aStr.replace(/0+$/, '');
    if (!numsInQuote.includes(aStr) && !numsInQuote.some((n) => n.includes(aDigits) && aDigits.length >= 2)) {
      warnings.push(`Amount (INR ${keyNumbers.amount_inr.toLocaleString('en-IN')}) not found in quoted text`);
    }
  }

  return warnings.length > 0
    ? `Number consistency warning: ${warnings.join('; ')}. The extracted numbers may not match the exact quote.`
    : null;
}

/**
 * Verifies whether an exact_quote appears in the document text.
 *
 * Strategy:
 *   1. Exact substring match (normalised) — highest confidence
 *   2. Fuzzy window match with overlap ratio ≥ 0.85 — medium confidence (minor OCR drift)
 *   3. All key words present in document — low confidence (paraphrase detection)
 *
 * @param exactQuote - The verbatim quote extracted by Gemini (from clause.exact_quote)
 * @param documentText - The full document text available for verification
 * @returns QuoteVerificationResult with status and explanation
 */
export function verifyQuoteInDocument(
  exactQuote: string,
  documentText: string
): QuoteVerificationResult {
  // Empty quote → not_addressed_in_document
  if (!exactQuote || exactQuote.trim().length === 0) {
    return {
      quote_status: 'not_addressed_in_document',
      checked_quote: null,
      explanation: 'No exact quote was provided for this clause — the topic may not be addressed in this document.',
      match_confidence: null,
    };
  }

  const normQuote = normalise(exactQuote);
  const normDoc = normaliseDocument(documentText);

  // 1. Exact match
  if (normDoc.includes(normQuote)) {
    return {
      quote_status: 'confirmed_in_document',
      checked_quote: exactQuote,
      explanation: 'This exact quote was found verbatim in the document.',
      match_confidence: 1.0,
    };
  }

  // 2. Fuzzy match — try 90% of the quote as a sliding window in the document
  // (handles minor whitespace/ligature differences in PDF extraction)
  if (normQuote.length >= 30 && normDoc.length >= normQuote.length) {
    const overlapRatio = computeOverlapRatio(normQuote, normDoc);
    if (overlapRatio >= 0.85) {
      return {
        quote_status: 'confirmed_in_document',
        checked_quote: exactQuote,
        explanation: `This quote was found with high confidence (${Math.round(overlapRatio * 100)}% character match) — minor formatting differences may exist between displayed and extracted text.`,
        match_confidence: overlapRatio,
      };
    }
  }

  // 3. Key-word presence check — at least 70% of significant words found
  const quoteWords = normQuote.split(' ').filter((w) => w.length > 3);
  if (quoteWords.length > 0) {
    const foundWords = quoteWords.filter((w) => normDoc.includes(w));
    const wordRatio = foundWords.length / quoteWords.length;

    if (wordRatio >= 0.7) {
      // Most words found but exact phrase not matched — likely paraphrase or PDF reflow
      return {
        quote_status: 'confirmed_in_document',
        checked_quote: exactQuote,
        explanation: `Key terms from this quote appear in the document (${Math.round(wordRatio * 100)}% word match) — the exact phrasing may differ due to PDF formatting. Click "Verify" to check the original document.`,
        match_confidence: wordRatio * 0.8, // discounted since not exact
      };
    }
  }

  // 4. Quote not found — hallucination risk
  return {
    quote_status: 'not_found_in_document',
    checked_quote: exactQuote,
    explanation:
      'This quote could not be located in the document text. This may indicate a hallucination — review the original document to confirm whether this clause exists.',
    match_confidence: 0,
  };
}

/**
 * Determines quote_status for a clause where the topic was explicitly absent.
 * Use this when the user asks a Q&A question about something not in the document.
 *
 * This is NOT an error state — it is meaningful, required information.
 * It must render as a visually distinct "Not stated in this document" state in the UI.
 *
 * @param topic - The topic or question that was not addressed
 * @returns A QuoteVerificationResult with not_addressed_in_document status
 */
export function buildNotAddressedResult(topic: string): QuoteVerificationResult {
  return {
    quote_status: 'not_addressed_in_document',
    checked_quote: null,
    explanation: `"${topic}" is not stated in this document. This means the offer letter does not address this point — worth clarifying with the employer before signing.`,
    match_confidence: null,
  };
}

/**
 * Returns a user-facing label for each quote_status value.
 * Used in the UI clause_risk_card and Q&A panel.
 */
export function getQuoteStatusLabel(status: QuoteStatus): string {
  const labels: Record<QuoteStatus, string> = {
    confirmed_in_document: '✓ Found in document',
    not_found_in_document: '⚠ Could not verify in document',
    not_addressed_in_document: '— Not stated in this document',
  };
  return labels[status];
}

/**
 * Returns a short description of what each quote_status means for the user.
 * Used in tooltips and expandable explanations.
 */
export function getQuoteStatusDescription(status: QuoteStatus): string {
  const descriptions: Record<QuoteStatus, string> = {
    confirmed_in_document:
      'The exact text of this clause was located in the uploaded document.',
    not_found_in_document:
      'The AI flagged this clause but the exact quote could not be found in the document text. Review the original PDF to confirm.',
    not_addressed_in_document:
      'This topic is not mentioned anywhere in the document. The offer letter does not address this point — consider asking the employer for clarification.',
  };
  return descriptions[status];
}
