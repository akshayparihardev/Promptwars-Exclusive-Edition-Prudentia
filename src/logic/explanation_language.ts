/**
 * explanation_language.ts
 *
 * The languages Prudentia can write its explanations in. The legal text itself
 * (exact_quote) always stays verbatim in the document's original language so
 * quote verification keeps working; only the explanatory fields are translated.
 */

export interface ExplanationLanguage {
  code: string;
  label: string;
  nativeLabel: string;
}

export const EXPLANATION_LANGUAGES: readonly ExplanationLanguage[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
];

export const DEFAULT_LANGUAGE: ExplanationLanguage = EXPLANATION_LANGUAGES[0];

/** Maps untrusted input (e.g. a request body field) to a supported language, defaulting to English. */
export function resolveExplanationLanguage(code: unknown): ExplanationLanguage {
  if (typeof code !== 'string') return DEFAULT_LANGUAGE;
  const normalised = code.trim().toLowerCase();
  return EXPLANATION_LANGUAGES.find((lang) => lang.code === normalised) ?? DEFAULT_LANGUAGE;
}

/** Prompt instruction for non-English output; empty for English (the prompt's default). */
export function buildLanguageInstruction(language: ExplanationLanguage): string {
  if (language.code === DEFAULT_LANGUAGE.code) return '';
  return `OUTPUT LANGUAGE — ${language.label.toUpperCase()} (${language.nativeLabel}):
- Write these fields in ${language.label}: document_type, title, plain_english, concern_rationale, trigger, consequence_steps, financial_estimate, unanswered_questions, consultation_questions.
- Do NOT translate or alter: exact_quote (must stay verbatim in the document's original language), clause_reference, JSON keys, applicable_law act/section values, offer_summary values (copy those as written in the document), or the disclaimer wording given above.
- Enum values (clause_type, concern_level, outcome_likelihood, overall_concern_level) must stay exactly as specified in the schema, in English.
- Use Western digits (0-9) for all numbers.`;
}
