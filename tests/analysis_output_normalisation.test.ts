import { describe, it, expect } from 'vitest';
import { normaliseAnalysisOutput, validateAnalysisOutput } from '../src/logic/analysis_schema_validator';

const baseClause = {
  id: 'clause_1',
  clause_type: 'bond',
  title: 'Service Bond',
  plain_english: 'Leaving before 12 months means paying the company back.',
  exact_quote: 'you shall be liable to pay compensation amounting to Rs. 1,00,000',
  page_hint: 1,
  concern_level: 'significant',
  concern_rationale: 'Only reasonable compensation for actual loss is recoverable under ICA Section 74.',
  key_numbers: { duration_months: 12, amount_inr: 100000, notice_days: null },
  applicable_law: [{ act: 'Indian Contract Act, 1872', section: '74' }],
  consequence_scenarios: [
    { trigger: 'You resign in month 6', consequence_steps: ['The bond amount is demanded'], financial_estimate: null, outcome_likelihood: 'possible' },
  ],
};

function analysisWith(clause: Record<string, unknown>, root: Record<string, unknown> = {}) {
  return {
    document_type: 'Employment Offer Letter',
    is_offer_letter: true,
    offer_summary: { company: null, role: null, ctc: null, joining_date: null },
    clauses: [clause],
    unanswered_questions: [],
    consultation_questions: [],
    overall_concern_level: 'significant',
    disclaimer: 'Informational only — not legal advice.',
    ...root,
  };
}

function firstClause(output: unknown): Record<string, unknown> {
  return (output as { clauses: Record<string, unknown>[] }).clauses[0]!;
}

describe('normaliseAnalysisOutput — benign slips a faster model makes', () => {
  it('turns "key_numbers": null into an object of nulls, which then validates', () => {
    const raw = analysisWith({ ...baseClause, key_numbers: null });
    expect(validateAnalysisOutput(raw).valid).toBe(false);

    const normalised = normaliseAnalysisOutput(raw);
    expect(firstClause(normalised)['key_numbers']).toEqual({ duration_months: null, amount_inr: null, notice_days: null });
    expect(validateAnalysisOutput(normalised).valid).toBe(true);
  });

  it('parses numeric strings (Indian digit grouping included) and drops non-numeric ones', () => {
    const normalised = normaliseAnalysisOutput(
      analysisWith({ ...baseClause, page_hint: '2', key_numbers: { duration_months: 'two years', amount_inr: '1,00,000', notice_days: '90' } })
    );
    expect(firstClause(normalised)['page_hint']).toBe(2);
    expect(firstClause(normalised)['key_numbers']).toEqual({ duration_months: null, amount_inr: 100000, notice_days: 90 });
    expect(validateAnalysisOutput(normalised).valid).toBe(true);
  });

  it('files an unknown clause category under the "general" catch-all', () => {
    const normalised = normaliseAnalysisOutput(analysisWith({ ...baseClause, clause_type: 'confidentiality' }));
    expect(firstClause(normalised)['clause_type']).toBe('general');
    expect(validateAnalysisOutput(normalised).valid).toBe(true);
  });

  it('fills missing lists and a missing financial_estimate with empty values', () => {
    const { applicable_law: _law, ...withoutLaw } = baseClause;
    const raw = analysisWith(
      { ...withoutLaw, consequence_scenarios: [{ trigger: 'x', consequence_steps: ['y'], outcome_likelihood: 'uncertain' }] },
      { unanswered_questions: null, consultation_questions: undefined }
    );
    const normalised = normaliseAnalysisOutput(raw);
    expect(validateAnalysisOutput(normalised).valid).toBe(true);
    expect(firstClause(normalised)['applicable_law']).toEqual([]);
  });

  it('never invents content: a missing disclaimer or an invalid concern level still fails', () => {
    const { disclaimer: _d, ...withoutDisclaimer } = analysisWith(baseClause);
    expect(validateAnalysisOutput(normaliseAnalysisOutput(withoutDisclaimer)).valid).toBe(false);
    expect(validateAnalysisOutput(normaliseAnalysisOutput(analysisWith({ ...baseClause, concern_level: 'high' }))).valid).toBe(false);
  });

  it('leaves non-object input untouched so validation reports it', () => {
    expect(normaliseAnalysisOutput(null)).toBeNull();
    expect(normaliseAnalysisOutput('oops')).toBe('oops');
  });
});
