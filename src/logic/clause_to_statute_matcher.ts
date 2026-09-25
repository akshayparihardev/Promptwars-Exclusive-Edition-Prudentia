/**
 * clause_to_statute_matcher.ts
 *
 * Deterministic, lookup-based mapping from clause type to relevant statute keys.
 *
 * Design rationale:
 *   - This is a pure lookup — no AI inference, no fuzzy matching.
 *   - The mapping is deterministic: the same clause_type always produces the same statute list.
 *   - This ensures the Gemini prompt always receives the correct legal context for a clause type,
 *     preventing the model from citing irrelevant or hallucinated statutes.
 *   - The lookup happens BEFORE the Gemini call; the relevant statute texts are injected
 *     into the prompt so Gemini reasons from real law, not its training data approximations.
 *
 * Statute keys must match keys in indian_statute_reference.ts.
 */

// @ts-ignore
import type { StatuteKey } from '../data/indian_statute_reference';
// @ts-ignore
import { INDIAN_STATUTE_REFERENCE, getStatuteSummaryForPrompt } from '../data/indian_statute_reference';

/** All clause types the system recognises. */
export type ClauseType =
  | 'bond'
  | 'non_compete'
  | 'notice_period'
  | 'probation'
  | 'ip_assignment'
  | 'general';

/**
 * Canonical mapping: clause type → list of applicable statute keys.
 * Build exactly this shape per spec.
 */
export const CLAUSE_TYPE_TO_STATUTE: Record<ClauseType, StatuteKey[]> = {
  bond: ['ICA_SEC_27', 'ICA_SEC_73', 'ICA_SEC_74'],
  non_compete: ['ICA_SEC_27', 'SRA_SEC_41'],
  notice_period: ['ICA_SEC_73', 'IE_SEC_3'],
  probation: ['ICA_SEC_23', 'IE_SEC_3'],
  ip_assignment: ['CA_SEC_17', 'PA_SEC_6'],
  general: [],
};

/**
 * Returns the list of statute keys applicable to a given clause type.
 * Always returns an array (empty for 'general').
 */
export function getStatuteKeysForClauseType(clauseType: ClauseType): StatuteKey[] {
  return CLAUSE_TYPE_TO_STATUTE[clauseType] ?? [];
}

/**
 * Returns the full statute entries for a given clause type.
 * Used when building the structured applicable_law field in the response schema.
 */
export function getStatuteEntriesForClauseType(
  clauseType: ClauseType
): Array<{ act: string; section: string }> {
  const keys = getStatuteKeysForClauseType(clauseType);
  return keys.map((key) => {
    const entry = INDIAN_STATUTE_REFERENCE[key];
    return { act: entry.act, section: entry.section };
  });
}

/**
 * Builds a formatted block of statute context for injection into the Gemini analysis prompt.
 * Each statute is represented by its relevance_note (not full text) to keep prompts concise.
 *
 * @param clauseType - The type of clause being analysed
 * @returns A formatted multi-line string of statute summaries, or empty string for 'general'
 */
export function buildStatuteContextForPrompt(clauseType: ClauseType): string {
  const keys = getStatuteKeysForClauseType(clauseType);
  if (keys.length === 0) return '';

  const lines = keys.map((key, index) => {
    const summary = getStatuteSummaryForPrompt(key);
    return `${index + 1}. ${summary}`;
  });

  return `Applicable Indian law for this clause type:\n${lines.join('\n')}`;
}

/**
 * Returns a human-readable label for a clause type.
 * Used in UI rendering and export builder.
 */
export function getClauseTypeLabel(clauseType: ClauseType): string {
  const labels: Record<ClauseType, string> = {
    bond: 'Service Bond',
    non_compete: 'Non-Compete / Restraint of Trade',
    notice_period: 'Notice Period',
    probation: 'Probation Period',
    ip_assignment: 'Intellectual Property Assignment',
    general: 'General Clause',
  };
  return labels[clauseType];
}
