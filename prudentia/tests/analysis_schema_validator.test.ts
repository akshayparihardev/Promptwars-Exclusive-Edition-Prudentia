/**
 * analysis_schema_validator.test.ts
 *
 * Tests for the Ajv-based schema validator.
 * Covers: valid inputs, missing required fields, wrong enum values, extra fields.
 */

import { describe, it, expect } from 'vitest';
import {
  validateAnalysisOutput,
  validateOrThrow,
  isPartiallyValid,
  type OfferLetterAnalysis,
} from '../src/logic/analysis_schema_validator';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validAnalysis: OfferLetterAnalysis = {
  document_type: 'Employment Offer Letter',
  is_offer_letter: true,
  offer_summary: {
    company: 'Acme Tech Pvt Ltd',
    role: 'Software Engineer',
    ctc: '12 LPA',
    joining_date: '1 November 2026',
  },
  clauses: [
    {
      id: 'clause_1',
      clause_type: 'bond',
      title: 'Service Bond',
      plain_english: 'You must stay for 18 months or pay ₹1,50,000.',
      exact_quote: 'The employee agrees to serve the company for a minimum period of 18 months.',
      page_hint: 3,
      concern_level: 'significant',
      concern_rationale:
        'Bond penalties are assessed for reasonable compensation under ICA Section 74 — the full amount may not be automatically awarded.',
      key_numbers: {
        duration_months: 18,
        amount_inr: 150000,
        notice_days: null,
      },
      applicable_law: [
        { act: 'Indian Contract Act, 1872', section: '73' },
        { act: 'Indian Contract Act, 1872', section: '74' },
      ],
      consequence_scenarios: [
        {
          trigger: 'Employee resigns before 18 months',
          consequence_steps: [
            'Employer may initiate legal proceedings to recover bond amount.',
            'Court assesses actual loss incurred by employer.',
            'Court may award a lesser amount than stated under ICA Section 74.',
          ],
          financial_estimate: '₹50,000–₹1,50,000 depending on actual employer loss',
          outcome_likelihood: 'possible',
        },
      ],
    },
  ],
  unanswered_questions: [],
  consultation_questions: [
    'Is the 18-month bond duration proportionate to the training investment made by the employer?',
  ],
  overall_concern_level: 'significant',
  disclaimer:
    'This analysis is for informational purposes only and does not constitute legal advice.',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('validateAnalysisOutput', () => {
  it('accepts a valid OfferLetterAnalysis object', () => {
    const result = validateAnalysisOutput(validAnalysis);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.document_type).toBe('Employment Offer Letter');
      expect(result.data.clauses).toHaveLength(1);
    }
  });

  it('rejects null input', () => {
    const result = validateAnalysisOutput(null);
    expect(result.valid).toBe(false);
  });

  it('rejects a plain string', () => {
    const result = validateAnalysisOutput('not an object');
    expect(result.valid).toBe(false);
  });

  it('rejects when is_offer_letter is missing', () => {
    const { is_offer_letter: _, ...withoutFlag } = validAnalysis;
    const result = validateAnalysisOutput(withoutFlag);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('is_offer_letter'))).toBe(true);
    }
  });

  it('rejects an invalid concern_level enum value', () => {
    const invalid = {
      ...validAnalysis,
      clauses: [
        {
          ...validAnalysis.clauses[0],
          concern_level: 'high', // invalid — not in our fresh terminology
        },
      ],
    };
    const result = validateAnalysisOutput(invalid);
    expect(result.valid).toBe(false);
  });

  it('rejects an invalid outcome_likelihood enum value', () => {
    const invalid = {
      ...validAnalysis,
      clauses: [
        {
          ...validAnalysis.clauses[0],
          consequence_scenarios: [
            {
              ...validAnalysis.clauses[0].consequence_scenarios[0],
              outcome_likelihood: 'likely', // invalid — spec uses 'probable'
            },
          ],
        },
      ],
    };
    const result = validateAnalysisOutput(invalid);
    expect(result.valid).toBe(false);
  });

  it('rejects an invalid clause_type enum value', () => {
    const invalid = {
      ...validAnalysis,
      clauses: [
        {
          ...validAnalysis.clauses[0],
          clause_type: 'nda', // invalid
        },
      ],
    };
    const result = validateAnalysisOutput(invalid);
    expect(result.valid).toBe(false);
  });

  it('rejects additional properties at root level', () => {
    const invalid = {
      ...validAnalysis,
      verdict: 'this is unenforceable', // extra field — forbidden
    };
    const result = validateAnalysisOutput(invalid);
    expect(result.valid).toBe(false);
  });

  it('rejects when disclaimer is missing', () => {
    const { disclaimer: _, ...withoutDisclaimer } = validAnalysis;
    const result = validateAnalysisOutput(withoutDisclaimer);
    expect(result.valid).toBe(false);
  });

  it('rejects when consultation_questions is empty (minItems: 1)', () => {
    const invalid = {
      ...validAnalysis,
      consultation_questions: [],
    };
    const result = validateAnalysisOutput(invalid);
    expect(result.valid).toBe(false);
  });

  it('accepts null values for nullable offer_summary fields', () => {
    const withNulls = {
      ...validAnalysis,
      offer_summary: {
        company: null,
        role: null,
        ctc: null,
        joining_date: null,
      },
    };
    const result = validateAnalysisOutput(withNulls);
    expect(result.valid).toBe(true);
  });

  it('accepts null for page_hint and key_numbers fields', () => {
    const withNulls = {
      ...validAnalysis,
      clauses: [
        {
          ...validAnalysis.clauses[0],
          page_hint: null,
          key_numbers: { duration_months: null, amount_inr: null, notice_days: null },
        },
      ],
    };
    const result = validateAnalysisOutput(withNulls);
    expect(result.valid).toBe(true);
  });

  it('accepts an empty clauses array (document not an offer letter)', () => {
    const notOffer = {
      ...validAnalysis,
      is_offer_letter: false,
      clauses: [],
      overall_concern_level: 'minor' as const,
    };
    const result = validateAnalysisOutput(notOffer);
    expect(result.valid).toBe(true);
  });

  it('returns typed data on success', () => {
    const result = validateAnalysisOutput(validAnalysis);
    expect(result.valid).toBe(true);
    if (result.valid) {
      // TypeScript type narrowing should give us full OfferLetterAnalysis
      expect(typeof result.data.disclaimer).toBe('string');
    }
  });
});

describe('validateOrThrow', () => {
  it('returns the typed object for valid input', () => {
    const data = validateOrThrow(validAnalysis);
    expect(data.is_offer_letter).toBe(true);
  });

  it('throws for invalid input with a descriptive message', () => {
    expect(() => validateOrThrow({ is_offer_letter: 'not_boolean' })).toThrow(
      'Gemini output failed schema validation'
    );
  });
});

describe('isPartiallyValid', () => {
  it('returns true when document_type and clauses array are present', () => {
    expect(
      isPartiallyValid({ document_type: 'Offer Letter', clauses: [] })
    ).toBe(true);
  });

  it('returns false for null', () => {
    expect(isPartiallyValid(null)).toBe(false);
  });

  it('returns false when clauses is not an array', () => {
    expect(isPartiallyValid({ document_type: 'x', clauses: 'not array' })).toBe(false);
  });
});
