import { describe, it, expect } from 'vitest';
import { validateAnalysisOutput } from '../src/logic/analysis_schema_validator';

const baseClause = {
  id: 'clause_1',
  clause_type: 'notice_period',
  title: 'Notice Period',
  plain_english: 'Either side must give 60 days notice.',
  exact_quote: 'either party shall give sixty (60) days advance written notice',
  page_hint: 1,
  concern_level: 'minor',
  concern_rationale: 'Compensation for breach is limited to actual loss under ICA Section 73.',
  key_numbers: { duration_months: null, amount_inr: null, notice_days: 60 },
  applicable_law: [{ act: 'Indian Contract Act, 1872', section: '73' }],
  consequence_scenarios: [],
};

function analysisWith(clause: Record<string, unknown>) {
  return {
    document_type: 'Employment Offer Letter',
    is_offer_letter: true,
    offer_summary: { company: null, role: null, ctc: null, joining_date: null },
    clauses: [clause],
    unanswered_questions: [],
    consultation_questions: [],
    overall_concern_level: 'minor',
    disclaimer: 'Informational only — not legal advice.',
  };
}

describe('clause_reference (e.g. "Clause 8.2, Page 14")', () => {
  it('is optional — older outputs without it stay valid', () => {
    expect(validateAnalysisOutput(analysisWith(baseClause)).valid).toBe(true);
  });

  it('accepts a string, a number, or null', () => {
    for (const ref of ['8.2', 'Clause 4', 3, null]) {
      expect(validateAnalysisOutput(analysisWith({ ...baseClause, clause_reference: ref })).valid).toBe(true);
    }
  });

  it('rejects a non-scalar value', () => {
    expect(validateAnalysisOutput(analysisWith({ ...baseClause, clause_reference: { number: 8 } })).valid).toBe(false);
  });
});
