/**
 * Edge case tests for the analysis pipeline.
 * Tests boundary conditions, malformed inputs, and defensive behavior.
 */

import { describe, it, expect } from 'vitest';
import { validateAnalysisOutput, isPartiallyValid } from '../src/logic/analysis_schema_validator';
import { verifyQuoteInDocument, verifyNumbers } from '../src/logic/document_quote_verifier';
import { buildRangeComparisonsForClause } from '../src/logic/clause_range_comparator';
import { getStatuteKeysForClauseType, buildStatuteContextForPrompt } from '../src/logic/clause_to_statute_matcher';

describe('Edge cases — verifyNumbers', () => {
  it('handles all-null key_numbers gracefully', () => {
    const result = verifyNumbers('some quote with 5 numbers', {
      duration_months: null,
      amount_inr: null,
      notice_days: null,
    });
    expect(result).toBeNull();
  });

  it('handles empty quote', () => {
    const result = verifyNumbers('', { duration_months: 12, amount_inr: null, notice_days: null });
    expect(result).toBeNull();
  });

  it('handles quote with no numbers', () => {
    const result = verifyNumbers('This clause has no numbers whatsoever', {
      duration_months: 12,
      amount_inr: null,
      notice_days: null,
    });
    expect(result).toBeNull();
  });

  it('handles large amounts correctly', () => {
    const result = verifyNumbers('penalty of 500000 rupees', {
      duration_months: null,
      amount_inr: 500000,
      notice_days: null,
    });
    expect(result).toBeNull();
  });
});

describe('Edge cases — verifyQuoteInDocument', () => {
  it('handles very short quotes (< 10 chars)', () => {
    const result = verifyQuoteInDocument('bond', 'This is a bond clause agreement.');
    // Short quotes should still be searchable
    expect(result.quote_status).toBeDefined();
  });

  it('handles Unicode in quotes', () => {
    const result = verifyQuoteInDocument('₹2,00,000', 'The penalty is ₹2,00,000 as damages.');
    expect(result.quote_status).toBe('confirmed_in_document');
  });

  it('handles case-insensitive matching', () => {
    const result = verifyQuoteInDocument(
      'SERVICE BOND CLAUSE',
      'This document contains a service bond clause for the employee.'
    );
    expect(result.quote_status).toBe('confirmed_in_document');
  });
});

describe('Edge cases — buildRangeComparisonsForClause', () => {
  it('handles zero as a valid number', () => {
    const result = buildRangeComparisonsForClause('bond', {
      duration_months: 0,
      amount_inr: 0,
      notice_days: null,
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('handles extremely large values', () => {
    const result = buildRangeComparisonsForClause('bond', {
      duration_months: 120,
      amount_inr: 10000000,
      notice_days: null,
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].position).toBe('above_range');
  });
});

describe('Edge cases — statute matcher', () => {
  it('returns statute keys for all valid clause types', () => {
    const types = ['bond', 'non_compete', 'notice_period', 'probation', 'ip_assignment', 'general'] as const;
    for (const t of types) {
      const keys = getStatuteKeysForClauseType(t);
      expect(Array.isArray(keys)).toBe(true);
    }
  });

  it('builds non-empty context for bond clause', () => {
    const ctx = buildStatuteContextForPrompt('bond');
    expect(ctx.length).toBeGreaterThan(0);
    expect(ctx).toContain('Indian Contract Act');
  });
});

describe('Edge cases — schema validation', () => {
  it('rejects undefined', () => {
    const result = validateAnalysisOutput(undefined);
    expect(result.valid).toBe(false);
  });

  it('rejects number input', () => {
    const result = validateAnalysisOutput(42);
    expect(result.valid).toBe(false);
  });

  it('rejects array input', () => {
    const result = validateAnalysisOutput([]);
    expect(result.valid).toBe(false);
  });

  it('isPartiallyValid returns false for empty object', () => {
    expect(isPartiallyValid({})).toBe(false);
  });

  it('isPartiallyValid returns false for object without clauses', () => {
    expect(isPartiallyValid({ document_type: 'test' })).toBe(false);
  });
});
