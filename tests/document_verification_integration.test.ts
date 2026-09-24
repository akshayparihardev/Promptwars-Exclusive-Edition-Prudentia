/**
 * Integration tests for the document verification pipeline.
 * 
 * Tests the full flow: given independently extracted PDF text and 
 * LLM-returned clauses, verify that quote verification and number
 * consistency checking work correctly together.
 */

import { describe, it, expect } from 'vitest';
import { verifyQuoteInDocument, verifyNumbers } from '../src/logic/document_quote_verifier';
import { buildRangeComparisonsForClause } from '../src/logic/clause_range_comparator';
import type { OfferClause } from '../src/logic/analysis_schema_validator';

// Simulated independently-extracted PDF text (what PDF.js would return)
const EXTRACTED_PDF_TEXT = `
EMPLOYMENT OFFER LETTER

Dear Candidate,

We are pleased to offer you the position of Software Engineer at TechCorp India Pvt Ltd.
Annual Cost to Company (CTC): INR 8,00,000 per annum.

1. PROBATION PERIOD
You will be on probation for a period of six (6) months from your date of joining.

2. NOTICE PERIOD
Either party wishing to terminate shall give sixty (60) days advance written notice.

3. SERVICE BOND
You agree to serve a minimum period of eighteen (18) months from your date of joining.
Should you leave before completing eighteen (18) months, you shall pay the Company
Rupees Two Lakh only (INR 2,00,000) as liquidated damages.

4. NON-COMPETE
For twelve (12) months following termination, you shall not be employed by any competitor.
`;

describe('Full verification pipeline — independent text', () => {
  it('verifies a correct bond quote against independently extracted text', () => {
    const quote = 'You agree to serve a minimum period of eighteen (18) months from your date of joining.';
    const result = verifyQuoteInDocument(quote, EXTRACTED_PDF_TEXT);
    expect(result.quote_status).toBe('confirmed_in_document');
  });

  it('flags a hallucinated quote that is NOT in the document', () => {
    const fakeQuote = 'The employee shall forfeit all accrued benefits upon early termination.';
    const result = verifyQuoteInDocument(fakeQuote, EXTRACTED_PDF_TEXT);
    expect(result.quote_status).toBe('not_found_in_document');
  });

  it('verifies number consistency for bond clause — correct numbers', () => {
    const quote = 'serve a minimum period of eighteen (18) months';
    const keyNumbers = { duration_months: 18, amount_inr: null, notice_days: null };
    const warning = verifyNumbers(quote, keyNumbers);
    expect(warning).toBeNull();
  });

  it('catches number inconsistency — wrong duration', () => {
    const quote = 'serve a minimum period of eighteen (18) months';
    const keyNumbers = { duration_months: 24, amount_inr: null, notice_days: null };
    const warning = verifyNumbers(quote, keyNumbers);
    expect(warning).not.toBeNull();
    expect(warning).toContain('24');
  });

  it('catches number inconsistency — wrong notice days', () => {
    const quote = 'give sixty (60) days advance written notice';
    const keyNumbers = { duration_months: null, amount_inr: null, notice_days: 30 };
    const warning = verifyNumbers(quote, keyNumbers);
    expect(warning).not.toBeNull();
    expect(warning).toContain('30');
  });

  it('passes number consistency — correct notice days', () => {
    const quote = 'give sixty (60) days advance written notice';
    const keyNumbers = { duration_months: null, amount_inr: null, notice_days: 60 };
    const warning = verifyNumbers(quote, keyNumbers);
    expect(warning).toBeNull();
  });

  it('range comparisons for bond clause produce valid output', () => {
    const keyNumbers = { duration_months: 18, amount_inr: 200000, notice_days: null };
    const comparisons = buildRangeComparisonsForClause('bond', keyNumbers);
    expect(comparisons.length).toBeGreaterThanOrEqual(1);
    expect(comparisons[0].position).toBeDefined();
    expect(comparisons[0].non_authoritative_label).toBeDefined();
  });

  it('verifies empty document text returns not_found', () => {
    const result = verifyQuoteInDocument('any quote', '');
    expect(result.quote_status).toBe('not_found_in_document');
  });

  it('verifies empty quote returns not_addressed', () => {
    const result = verifyQuoteInDocument('', EXTRACTED_PDF_TEXT);
    expect(result.quote_status).toBe('not_addressed_in_document');
  });
});
