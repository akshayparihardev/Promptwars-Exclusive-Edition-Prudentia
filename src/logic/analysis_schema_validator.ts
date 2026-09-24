/**
 * analysis_schema_validator.ts
 *
 * Server-side JSON Schema validation for the OfferLetterAnalysis output from Gemini.
 * Uses Ajv (Another JSON Validator) with strict mode to enforce the full interface shape.
 *
 * Why server-side validation:
 *   - Gemini is a probabilistic model — it can produce structurally invalid output.
 *   - Validating before sending to the client prevents silent failures and hallucination
 *     of extra fields (e.g., a "verdict" field we never asked for) from reaching the UI.
 *   - The schema is the single source of truth for the contract between the AI call
 *     and the rest of the application.
 *
 * Validation policy:
 *   - additionalProperties: false on all objects — extra fields are rejected.
 *   - Required fields are strictly enforced.
 *   - enum constraints enforce the fresh terminology (concern_level, outcome_likelihood, quote_status).
 */

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

// ─── Type definitions (mirrors TypeScript interface from spec) ────────────────

export interface ApplicableLaw {
  act: string;
  section: string;
}

export interface KeyNumbers {
  duration_months: number | null;
  amount_inr: number | null;
  notice_days: number | null;
}

export interface ConsequenceScenario {
  trigger: string;
  consequence_steps: string[];
  financial_estimate: string | null;
  outcome_likelihood: 'probable' | 'possible' | 'uncertain';
}

export interface OfferClause {
  id: string;
  clause_type: 'bond' | 'non_compete' | 'notice_period' | 'probation' | 'ip_assignment' | 'general';
  title: string;
  plain_english: string;
  exact_quote: string;
  page_hint: number | null;
  concern_level: 'minor' | 'moderate' | 'significant';
  concern_rationale: string;
  key_numbers: KeyNumbers;
  applicable_law: ApplicableLaw[];
  consequence_scenarios: ConsequenceScenario[];
}

export interface OfferSummary {
  company: string | null;
  role: string | null;
  ctc: string | null;
  joining_date: string | null;
}

export interface OfferLetterAnalysis {
  document_type: string;
  is_offer_letter: boolean;
  offer_summary: OfferSummary;
  clauses: OfferClause[];
  unanswered_questions: string[];
  consultation_questions: string[];
  overall_concern_level: 'minor' | 'moderate' | 'significant';
  disclaimer: string;
}

// ─── Ajv JSON Schema ──────────────────────────────────────────────────────────

/**
 * JSON Schema for OfferLetterAnalysis.
 * Note: Ajv does not support TypeScript's `null` union in JSONSchemaType directly
 * for nullable primitive fields — we use `nullable: true` pattern via anyOf.
 */
const offerLetterAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'document_type',
    'is_offer_letter',
    'offer_summary',
    'clauses',
    'unanswered_questions',
    'consultation_questions',
    'overall_concern_level',
    'disclaimer',
  ],
  properties: {
    document_type: { type: 'string', minLength: 1 },
    is_offer_letter: { type: 'boolean' },

    offer_summary: {
      type: 'object',
      additionalProperties: false,
      required: ['company', 'role', 'ctc', 'joining_date'],
      properties: {
        company: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        role: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        ctc: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        joining_date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
    },

    clauses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'clause_type',
          'title',
          'plain_english',
          'exact_quote',
          'page_hint',
          'concern_level',
          'concern_rationale',
          'key_numbers',
          'applicable_law',
          'consequence_scenarios',
        ],
        properties: {
          id: { type: 'string', minLength: 1 },
          clause_type: {
            type: 'string',
            enum: ['bond', 'non_compete', 'notice_period', 'probation', 'ip_assignment', 'general'],
          },
          title: { type: 'string', minLength: 1 },
          plain_english: { type: 'string', minLength: 1 },
          exact_quote: { type: 'string', minLength: 1 },
          page_hint: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          concern_level: {
            type: 'string',
            enum: ['minor', 'moderate', 'significant'],
          },
          concern_rationale: { type: 'string', minLength: 1 },
          key_numbers: {
            type: 'object',
            additionalProperties: false,
            required: ['duration_months', 'amount_inr', 'notice_days'],
            properties: {
              duration_months: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              amount_inr: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              notice_days: { anyOf: [{ type: 'number' }, { type: 'null' }] },
            },
          },
          applicable_law: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['act', 'section'],
              properties: {
                act: { type: 'string', minLength: 1 },
                section: { type: 'string', minLength: 1 },
              },
            },
          },
          consequence_scenarios: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['trigger', 'consequence_steps', 'financial_estimate', 'outcome_likelihood'],
              properties: {
                trigger: { type: 'string', minLength: 1 },
                consequence_steps: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                },
                financial_estimate: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                outcome_likelihood: {
                  type: 'string',
                  enum: ['probable', 'possible', 'uncertain'],
                },
              },
            },
          },
        },
      },
    },

    unanswered_questions: {
      type: 'array',
      items: { type: 'string' },
    },

    consultation_questions: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },

    overall_concern_level: {
      type: 'string',
      enum: ['minor', 'moderate', 'significant'],
    },

    disclaimer: { type: 'string', minLength: 1 },
  },
} as const;

// ─── Validator instance ───────────────────────────────────────────────────────

const ajv = new (Ajv as any)({ allErrors: true, strict: false });
(addFormats as any)(ajv);

let _compiledValidator: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (!_compiledValidator) {
    _compiledValidator = ajv.compile(offerLetterAnalysisSchema);
  }
  return _compiledValidator;
}

// ─── Validation result type ───────────────────────────────────────────────────

export interface ValidationSuccess {
  valid: true;
  data: OfferLetterAnalysis;
}

export interface ValidationFailure {
  valid: false;
  errors: string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validates a raw JSON object against the OfferLetterAnalysis schema.
 * Returns a typed success result or a list of human-readable error messages.
 *
 * @param raw - The parsed JSON object from Gemini's response
 * @returns ValidationResult — caller must check `.valid` before using `.data`
 */
export function validateAnalysisOutput(raw: unknown): ValidationResult {
  const validate = getValidator();
  const valid = validate(raw);

  if (valid) {
    return { valid: true, data: raw as OfferLetterAnalysis };
  }

  const errors = (validate.errors ?? []).map((err) => {
    const path = err.instancePath || '(root)';
    return `${path}: ${err.message}`;
  });

  return { valid: false, errors };
}

/**
 * Validates and throws if invalid — convenience wrapper for API route usage.
 * Use this when you want to short-circuit with an HTTP 500 on invalid AI output.
 *
 * @param raw - The parsed JSON object from Gemini's response
 * @returns The validated, typed OfferLetterAnalysis
 * @throws Error with joined validation messages if schema is violated
 */
export function validateOrThrow(raw: unknown): OfferLetterAnalysis {
  const result = validateAnalysisOutput(raw);
  if (!result.valid) {
    throw new Error(`Gemini output failed schema validation:\n${(result as any).errors.join('\n')}`);
  }
  return result.data;
}

/**
 * Checks whether a raw object has the minimum fields needed to attempt repair
 * (e.g., has `clauses` array but some items are malformed).
 * Used to decide between retrying the Gemini call vs. attempting partial recovery.
 */
export function isPartiallyValid(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj['document_type'] === 'string' &&
    Array.isArray(obj['clauses'])
  );
}
