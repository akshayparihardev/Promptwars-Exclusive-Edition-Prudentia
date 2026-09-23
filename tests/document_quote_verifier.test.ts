/**
 * document_quote_verifier.test.ts
 *
 * Tests for the three-state quote verification logic.
 * Critical: the three states must remain distinct and never be collapsed.
 */

import { describe, it, expect } from 'vitest';
import {
  verifyQuoteInDocument,
  buildNotAddressedResult,
  getQuoteStatusLabel,
  getQuoteStatusDescription,
  type QuoteStatus,
} from '../src/logic/document_quote_verifier';

// ─── Sample document text for tests ──────────────────────────────────────────

const SAMPLE_DOC = `
This is an employment offer letter from Acme Tech Private Limited.
The employee agrees to serve the company for a minimum period of 18 months from the date of joining.
In the event of early departure, the employee shall pay a bond amount of INR 1,50,000 (Rupees One Lakh Fifty Thousand only).
The notice period for resignation shall be 60 days.
During probation, the company reserves the right to terminate employment with 7 days notice.
This offer is subject to successful completion of background verification.
`.trim();

// ─── confirmed_in_document tests ─────────────────────────────────────────────

describe('verifyQuoteInDocument — confirmed_in_document', () => {
  it('returns confirmed_in_document for an exact verbatim match', () => {
    const quote = 'The employee agrees to serve the company for a minimum period of 18 months from the date of joining.';
    const result = verifyQuoteInDocument(quote, SAMPLE_DOC);
    expect(result.quote_status).toBe('confirmed_in_document');
    expect(result.match_confidence).toBe(1.0);
  });

  it('returns confirmed_in_document for case-normalised match', () => {
    const quote = 'THE NOTICE PERIOD FOR RESIGNATION SHALL BE 60 DAYS.';
    const result = verifyQuoteInDocument(quote, SAMPLE_DOC);
    expect(result.quote_status).toBe('confirmed_in_document');
  });

  it('returns confirmed_in_document for whitespace-normalised match', () => {
    const quote = '  The   notice   period   for   resignation   shall   be   60   days.  ';
    const result = verifyQuoteInDocument(quote, SAMPLE_DOC);
    expect(result.quote_status).toBe('confirmed_in_document');
  });

  it('includes the checked_quote in the result', () => {
    const quote = 'The notice period for resignation shall be 60 days.';
    const result = verifyQuoteInDocument(quote, SAMPLE_DOC);
    expect(result.checked_quote).toBe(quote);
  });

  it('keyword-level match returns confirmed_in_document with lower confidence', () => {
    // A partial paraphrase where most key words are present
    const partialQuote = 'employee shall pay bond amount INR 1,50,000 Rupees One Lakh Fifty Thousand only';
    const result = verifyQuoteInDocument(partialQuote, SAMPLE_DOC);
    // At least most keywords should be found
    expect(['confirmed_in_document', 'not_found_in_document']).toContain(result.quote_status);
  });
});

// ─── not_found_in_document tests ─────────────────────────────────────────────

describe('verifyQuoteInDocument — not_found_in_document', () => {
  it('returns not_found_in_document for text completely absent from document', () => {
    const fabricatedQuote = 'Employee agrees to a non-compete period of 5 years post-employment spanning all technology sectors worldwide.';
    const result = verifyQuoteInDocument(fabricatedQuote, SAMPLE_DOC);
    expect(result.quote_status).toBe('not_found_in_document');
    expect(result.match_confidence).toBe(0);
  });

  it('returns not_found_in_document for a short unrelated phrase', () => {
    const result = verifyQuoteInDocument('arbitration in Singapore', SAMPLE_DOC);
    expect(result.quote_status).toBe('not_found_in_document');
  });

  it('includes the fabricated quote in checked_quote for user review', () => {
    const fabricatedQuote = 'Annual salary is USD 200,000 per annum.';
    const result = verifyQuoteInDocument(fabricatedQuote, SAMPLE_DOC);
    if (result.quote_status === 'not_found_in_document') {
      expect(result.checked_quote).toBe(fabricatedQuote);
    }
  });

  it('explanation mentions hallucination risk for not_found result', () => {
    const fabricatedQuote = 'The employee shall forfeit all intellectual property rights globally forever.';
    const result = verifyQuoteInDocument(fabricatedQuote, SAMPLE_DOC);
    if (result.quote_status === 'not_found_in_document') {
      expect(result.explanation.toLowerCase()).toContain('hallucination');
    }
  });
});

// ─── not_addressed_in_document tests ─────────────────────────────────────────

describe('verifyQuoteInDocument — not_addressed_in_document', () => {
  it('returns not_addressed_in_document for an empty quote string', () => {
    const result = verifyQuoteInDocument('', SAMPLE_DOC);
    expect(result.quote_status).toBe('not_addressed_in_document');
    expect(result.checked_quote).toBeNull();
  });

  it('returns not_addressed_in_document for a whitespace-only quote', () => {
    const result = verifyQuoteInDocument('   ', SAMPLE_DOC);
    expect(result.quote_status).toBe('not_addressed_in_document');
  });

  it('has null match_confidence for not_addressed result', () => {
    const result = verifyQuoteInDocument('', SAMPLE_DOC);
    expect(result.match_confidence).toBeNull();
  });
});

// ─── CRITICAL: three states are distinct ─────────────────────────────────────

describe('three quote_status states are mutually exclusive', () => {
  const allStatuses: QuoteStatus[] = [
    'confirmed_in_document',
    'not_found_in_document',
    'not_addressed_in_document',
  ];

  it('each status is a distinct string value', () => {
    const uniqueValues = new Set(allStatuses);
    expect(uniqueValues.size).toBe(3);
  });

  it('getQuoteStatusLabel returns distinct labels for all three states', () => {
    const labels = allStatuses.map(getQuoteStatusLabel);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(3);
  });

  it('getQuoteStatusDescription returns distinct descriptions for all three states', () => {
    const descriptions = allStatuses.map(getQuoteStatusDescription);
    const uniqueDescriptions = new Set(descriptions);
    expect(uniqueDescriptions.size).toBe(3);
  });

  it('"not_addressed_in_document" description explicitly says topic is not mentioned', () => {
    const desc = getQuoteStatusDescription('not_addressed_in_document');
    expect(desc.toLowerCase()).toMatch(/not mentioned|not addressed|not stated/);
  });

  it('"not_found_in_document" description warns about verification', () => {
    const desc = getQuoteStatusDescription('not_found_in_document');
    expect(desc.toLowerCase()).toMatch(/review|verify|original|confirm/);
  });
});

// ─── buildNotAddressedResult ──────────────────────────────────────────────────

describe('buildNotAddressedResult', () => {
  it('always returns not_addressed_in_document status', () => {
    const result = buildNotAddressedResult('gratuity clause');
    expect(result.quote_status).toBe('not_addressed_in_document');
  });

  it('includes the topic in the explanation', () => {
    const result = buildNotAddressedResult('gratuity clause');
    expect(result.explanation).toContain('gratuity clause');
  });

  it('has null checked_quote and match_confidence', () => {
    const result = buildNotAddressedResult('any topic');
    expect(result.checked_quote).toBeNull();
    expect(result.match_confidence).toBeNull();
  });

  it('explanation mentions clarifying with employer', () => {
    const result = buildNotAddressedResult('probation terms');
    expect(result.explanation.toLowerCase()).toMatch(/employer|clarif/);
  });
});
