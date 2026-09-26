/**
 * clause_reference_formatter.ts
 *
 * Formats where a clause sits in the source document, e.g. "Clause 8.2 · Page 14",
 * so every flagged clause can be checked against the original with one click.
 */

// "Section 3", "clause 4 – Notice", "Para. 5(b)"
const NAMED_REFERENCE =
  /^(clause|section|article|para(?:graph)?|schedule|annexure|part|point)\b\.?\s*[:#-]?\s*(\d+(?:\.\d+)*(?:\s*\([a-z0-9]+\))?|[ivxlcdm]+\b)/i;
// "8.2", "3(a)", "1. PROBATION PERIOD" → the leading number only
const NUMBERED_REFERENCE = /^(\d+(?:\.\d+)*(?:\s*\([a-z0-9]+\))?)(?!\d)/;
// "IV", "II. Notice Period"
const ROMAN_REFERENCE = /^([ivxlcdm]+)(?=[.)\s:-]|$)/i;

/**
 * Turns the model's clause_reference into a display label ("Clause 8.2", "Section 3").
 * Only the identifier is kept, even if the model included the heading text.
 * Returns null when there is no clause number (the document doesn't number its clauses).
 */
export function formatClauseReference(ref: unknown): string | null {
  if (typeof ref === 'number') return Number.isFinite(ref) ? `Clause ${ref}` : null;
  if (typeof ref !== 'string') return null;

  const trimmed = ref.trim();

  const named = NAMED_REFERENCE.exec(trimmed);
  if (named) {
    const word = named[1].toLowerCase();
    return `${word.charAt(0).toUpperCase()}${word.slice(1)} ${named[2]}`;
  }

  const numbered = NUMBERED_REFERENCE.exec(trimmed);
  if (numbered) return `Clause ${numbered[1]}`;

  const roman = ROMAN_REFERENCE.exec(trimmed);
  if (roman) return `Clause ${roman[1].toUpperCase()}`;

  return null;
}

/**
 * Combines the clause reference and page into one location label:
 * "Clause 8.2 · Page 14", "Clause 8.2", "Page 14", or null if neither is known.
 */
export function formatSourceLocation(ref: unknown, page: number | null | undefined): string | null {
  const clause = formatClauseReference(ref);
  const pageLabel = typeof page === 'number' && page > 0 ? `Page ${page}` : null;
  if (clause && pageLabel) return `${clause} · ${pageLabel}`;
  return clause ?? pageLabel;
}
