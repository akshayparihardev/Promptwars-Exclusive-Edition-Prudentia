import { describe, it, expect } from 'vitest';
import { verifyQuoteInDocument } from '../src/logic/document_quote_verifier';

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
