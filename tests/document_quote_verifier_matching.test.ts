import { describe, it, expect } from 'vitest';
import { verifyNumbers, verifyQuoteInDocument } from '../src/logic/document_quote_verifier';

describe('verifyNumbers — digit grouping', () => {
  const noDuration = { duration_months: null, notice_days: null };

  it('reads an Indian-grouped amount ("Rs. [1,00,000]/-") as 100000', () => {
    const quote = 'you shall be liable to pay compensation amounting to Rs. [1,00,000]/- (Rupees One Lakh).';
    expect(verifyNumbers(quote, { ...noDuration, amount_inr: 100000 })).toBeNull();
  });

  it('reads a Western-grouped amount ("INR 250,000") as 250000', () => {
    expect(verifyNumbers('a bond of INR 250,000 applies', { ...noDuration, amount_inr: 250000 })).toBeNull();
  });

  it('still flags an amount that genuinely differs from the quote', () => {
    const warning = verifyNumbers('compensation amounting to Rs. 1,00,000', { ...noDuration, amount_inr: 200000 });
    expect(warning).toContain('Amount');
  });
});

const DOC_A = 'Upon confirmation, either party shall give sixty (60) days advance written notice to terminate employment.';
const DOC_B = 'This letter confirms a stipend of INR 35,000 per month for the internship period.';

describe('verifyQuoteInDocument — fuzzy matching', () => {
  it('confirms a long quote with a one-character extraction difference, below full confidence', () => {
    const quote = 'either party shall give sixty (60) days advance writen notice';
    const result = verifyQuoteInDocument(quote, DOC_A);
    expect(result.quote_status).toBe('confirmed_in_document');
    expect(result.match_confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.match_confidence).toBeLessThan(1);
  });

  it('does not confirm an unrelated quote', () => {
    const result = verifyQuoteInDocument('the employee shall not join any competitor for two years', DOC_A);
    expect(result.quote_status).toBe('not_found_in_document');
  });
});

describe('verifyQuoteInDocument — normalised-document cache', () => {
  it('re-verifies against the new document when the document text changes', () => {
    const quote = 'either party shall give sixty (60) days advance written notice';
    expect(verifyQuoteInDocument(quote, DOC_A).quote_status).toBe('confirmed_in_document');
    expect(verifyQuoteInDocument(quote, DOC_B).quote_status).toBe('not_found_in_document');
    expect(verifyQuoteInDocument(quote, DOC_A).quote_status).toBe('confirmed_in_document');
  });
});
