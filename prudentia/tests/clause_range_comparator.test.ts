/**
 * clause_range_comparator.test.ts
 *
 * Tests for the clause numeric value vs. observed-practice range comparator.
 * Validates position detection, non-authoritative labels, and null handling.
 */

import { describe, it, expect } from 'vitest';
import {
  compareClauseValueToRange,
  buildRangeComparisonsForClause,
  getRangePositionLabel,
  type RangePosition,
} from '../src/logic/clause_range_comparator';

// ─── compareClauseValueToRange ────────────────────────────────────────────────

describe('compareClauseValueToRange — bond_duration_months', () => {
  it('returns within_range for 18 months (low: 12, high: 24)', () => {
    const result = compareClauseValueToRange('bond_duration_months', 18);
    expect(result.position).toBe('within_range');
    expect(result.range_low).toBe(12);
    expect(result.range_high).toBe(24);
  });

  it('returns within_range for exactly the low bound (12 months)', () => {
    const result = compareClauseValueToRange('bond_duration_months', 12);
    expect(result.position).toBe('within_range');
  });

  it('returns within_range for exactly the high bound (24 months)', () => {
    const result = compareClauseValueToRange('bond_duration_months', 24);
    expect(result.position).toBe('within_range');
  });

  it('returns below_range for 6 months (below 12)', () => {
    const result = compareClauseValueToRange('bond_duration_months', 6);
    expect(result.position).toBe('below_range');
  });

  it('returns above_range for 36 months (above 24)', () => {
    const result = compareClauseValueToRange('bond_duration_months', 36);
    expect(result.position).toBe('above_range');
  });

  it('always includes a non_authoritative_label', () => {
    const result = compareClauseValueToRange('bond_duration_months', 18);
    expect(typeof result.non_authoritative_label).toBe('string');
    expect(result.non_authoritative_label.length).toBeGreaterThan(0);
  });

  it('non_authoritative_label is NOT the same as the summary', () => {
    const result = compareClauseValueToRange('bond_duration_months', 18);
    expect(result.non_authoritative_label).not.toBe(result.summary);
  });
});

describe('compareClauseValueToRange — notice_period_days', () => {
  it('returns within_range for 60 days (low: 30, high: 90)', () => {
    const result = compareClauseValueToRange('notice_period_days', 60);
    expect(result.position).toBe('within_range');
  });

  it('returns above_range for 120 days', () => {
    const result = compareClauseValueToRange('notice_period_days', 120);
    expect(result.position).toBe('above_range');
  });

  it('returns below_range for 14 days', () => {
    const result = compareClauseValueToRange('notice_period_days', 14);
    expect(result.position).toBe('below_range');
  });
});

describe('compareClauseValueToRange — bond_penalty_inr', () => {
  it('returns within_range for ₹1,50,000', () => {
    const result = compareClauseValueToRange('bond_penalty_inr', 150000);
    expect(result.position).toBe('within_range');
  });

  it('returns above_range for ₹5,00,000', () => {
    const result = compareClauseValueToRange('bond_penalty_inr', 500000);
    expect(result.position).toBe('above_range');
  });

  it('non_authoritative_label mentions ICA', () => {
    const result = compareClauseValueToRange('bond_penalty_inr', 150000);
    expect(result.non_authoritative_label).toContain('ICA');
  });
});

describe('compareClauseValueToRange — unknown key', () => {
  it('returns no_range_data for an unknown key', () => {
    // @ts-expect-error — testing runtime behavior with unknown key
    const result = compareClauseValueToRange('unknown_range_key', 100);
    expect(result.position).toBe('no_range_data');
    expect(result.range_low).toBeNull();
    expect(result.range_high).toBeNull();
  });
});

// ─── buildRangeComparisonsForClause ──────────────────────────────────────────

describe('buildRangeComparisonsForClause', () => {
  it('returns duration and penalty comparisons for bond clause with both numbers', () => {
    const results = buildRangeComparisonsForClause('bond', {
      duration_months: 18,
      amount_inr: 150000,
      notice_days: null,
    });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.range_key)).toContain('bond_duration_months');
    expect(results.map((r) => r.range_key)).toContain('bond_penalty_inr');
  });

  it('returns only duration comparison when amount_inr is null', () => {
    const results = buildRangeComparisonsForClause('bond', {
      duration_months: 18,
      amount_inr: null,
      notice_days: null,
    });
    expect(results).toHaveLength(1);
    expect(results[0].range_key).toBe('bond_duration_months');
  });

  it('returns notice_period comparison for notice_period clause', () => {
    const results = buildRangeComparisonsForClause('notice_period', {
      duration_months: null,
      amount_inr: null,
      notice_days: 60,
    });
    expect(results).toHaveLength(1);
    expect(results[0].range_key).toBe('notice_period_days');
  });

  it('returns probation comparison for probation clause', () => {
    const results = buildRangeComparisonsForClause('probation', {
      duration_months: 3,
      amount_inr: null,
      notice_days: null,
    });
    expect(results).toHaveLength(1);
    expect(results[0].range_key).toBe('probation_duration_months');
  });

  it('returns empty array when all key_numbers are null', () => {
    const results = buildRangeComparisonsForClause('bond', {
      duration_months: null,
      amount_inr: null,
      notice_days: null,
    });
    expect(results).toHaveLength(0);
  });

  it('returns empty array for ip_assignment clause (no numeric ranges defined)', () => {
    const results = buildRangeComparisonsForClause('ip_assignment', {
      duration_months: null,
      amount_inr: null,
      notice_days: null,
    });
    expect(results).toHaveLength(0);
  });

  it('returns empty array for general clause', () => {
    const results = buildRangeComparisonsForClause('general', {
      duration_months: 6,
      amount_inr: 100000,
      notice_days: 30,
    });
    expect(results).toHaveLength(0);
  });

  it('all results have non_authoritative_label', () => {
    const results = buildRangeComparisonsForClause('bond', {
      duration_months: 18,
      amount_inr: 150000,
      notice_days: null,
    });
    for (const r of results) {
      expect(typeof r.non_authoritative_label).toBe('string');
      expect(r.non_authoritative_label.length).toBeGreaterThan(0);
    }
  });
});

// ─── getRangePositionLabel ────────────────────────────────────────────────────

describe('getRangePositionLabel', () => {
  it('returns distinct labels for all four positions', () => {
    const positions: RangePosition[] = ['within_range', 'above_range', 'below_range', 'no_range_data'];
    const labels = positions.map(getRangePositionLabel);
    const unique = new Set(labels);
    expect(unique.size).toBe(4);
  });

  it('label for within_range mentions "typical" or "within"', () => {
    const label = getRangePositionLabel('within_range');
    expect(label.toLowerCase()).toMatch(/typical|within/);
  });

  it('label for above_range mentions "above"', () => {
    const label = getRangePositionLabel('above_range');
    expect(label.toLowerCase()).toContain('above');
  });
});
