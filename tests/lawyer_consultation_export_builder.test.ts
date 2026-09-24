/**
 * Tests for lawyer_consultation_export_builder.ts
 * Validates HTML export generation for lawyer consultations.
 */

import { describe, it, expect } from 'vitest';
import { buildLawyerConsultationExport } from '../src/logic/lawyer_consultation_export_builder';
import type { OfferLetterAnalysis } from '../src/logic/analysis_schema_validator';

const SAMPLE_ANALYSIS: OfferLetterAnalysis = {
  document_type: 'Employment Offer Letter',
  is_offer_letter: true,
  offer_summary: {
    company: 'TestCorp',
    role: 'Engineer',
    ctc: 'INR 10,00,000',
    joining_date: 'Jan 1, 2025',
  },
  clauses: [
    {
      id: 'clause_1',
      clause_type: 'bond',
      title: 'Service Bond',
      plain_english: 'You must stay 18 months.',
      exact_quote: 'You agree to serve 18 months.',
      page_hint: 1,
      concern_level: 'significant',
      concern_rationale: 'May be challenged under ICA §27.',
      key_numbers: { duration_months: 18, amount_inr: 200000, notice_days: null },
      applicable_law: [{ act: 'Indian Contract Act, 1872', section: '27' }],
      consequence_scenarios: [{
        trigger: 'Employee leaves early.',
        consequence_steps: ['Company demands payment.'],
        financial_estimate: 'Up to INR 2L',
        outcome_likelihood: 'possible',
      }],
    },
  ],
  unanswered_questions: ['What training is provided?'],
  consultation_questions: ['Is the bond enforceable?'],
  overall_concern_level: 'significant',
  disclaimer: 'This is not legal advice.',
};

describe('buildLawyerConsultationExport', () => {
  const html = buildLawyerConsultationExport(SAMPLE_ANALYSIS, { fileName: "test.pdf" });

  it('returns a valid HTML string', () => {
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('includes the company name', () => {
    expect(html).toContain('TestCorp');
  });

  it('includes the clause title', () => {
    expect(html).toContain('Service Bond');
  });

  it('includes the exact quote', () => {
    expect(html).toContain('You agree to serve 18 months.');
  });

  it('includes applicable law references', () => {
    expect(html).toContain('Indian Contract Act');
    expect(html).toContain('Section 27');
  });

  it('includes consultation questions', () => {
    expect(html).toContain('Is the bond enforceable?');
  });

  it('includes the disclaimer', () => {
    expect(html).toContain('not legal advice');
  });

  it('includes unanswered questions', () => {
    expect(html).toContain('What training is provided?');
  });

  

  it('includes concern level', () => {
    expect(html).toContain("SIGNIFICANT");
  });

  it('handles null offer_summary fields gracefully', () => {
    const nullAnalysis = { ...SAMPLE_ANALYSIS, offer_summary: { company: null, role: null, ctc: null, joining_date: null } };
    const result = buildLawyerConsultationExport(nullAnalysis, { fileName: "test.pdf" });
    expect(result).toContain('<html');
  });

  it('handles empty clauses array', () => {
    const emptyAnalysis = { ...SAMPLE_ANALYSIS, clauses: [] };
    const result = buildLawyerConsultationExport(emptyAnalysis, { fileName: "test.pdf" });
    expect(result).toContain('<html');
  });
});
