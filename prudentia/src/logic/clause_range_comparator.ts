/**
 * clause_range_comparator.ts
 *
 * Compares extracted numeric values from a clause against the typical_clause_range_reference.
 *
 * Purpose: Powers the "compare" use-case from the PS coverage table.
 * Tells a first-time offer-letter reader whether a number (e.g., 18-month bond, 90-day notice period)
 * is within, above, or below commonly observed practice.
 *
 * ⚠️ NON-AUTHORITATIVE — all outputs from this module carry the range's non_authoritative_label.
 *    Never present comparison results as legal conclusions.
 *    Always display alongside applicable_law citations with clearly lower confidence.
 */

import { TYPICAL_RANGES, type RangeKey } from '../data/typical_clause_range_reference';

/** Where the extracted value falls relative to the observed-practice range. */
export type RangePosition = 'within_range' | 'above_range' | 'below_range' | 'no_range_data';

export interface RangeComparisonResult {
  range_key: RangeKey | null;
  extracted_value: number;
  unit: string;
  position: RangePosition;
  /** The observed-practice low bound, for display. */
  range_low: number | null;
  /** The observed-practice high bound, for display. */
  range_high: number | null;
  /** Human-readable summary of the comparison result. */
  summary: string;
  /** Mandatory disclaimer — must be displayed on every surface that shows this result. */
  non_authoritative_label: string;
}

/**
 * Compares a single extracted numeric value against its corresponding range.
 *
 * @param rangeKey - Key from typical_clause_range_reference (e.g. 'bond_duration_months')
 * @param value - The numeric value extracted from the document clause
 * @returns A full comparison result with position, summary, and mandatory disclaimer
 */
export function compareClauseValueToRange(
  rangeKey: RangeKey,
  value: number
): RangeComparisonResult {
  const range = TYPICAL_RANGES[rangeKey];

  if (!range) {
    return {
      range_key: null,
      extracted_value: value,
      unit: '',
      position: 'no_range_data',
      range_low: null,
      range_high: null,
      summary: 'No comparison data available for this clause type.',
      non_authoritative_label: 'Observed practice only — not a legal standard.',
    };
  }

  let position: RangePosition;
  let summary: string;

  if (value < range.low) {
    position = 'below_range';
    summary = `${value} ${range.unit} is below the commonly observed range of ${range.low}–${range.high} ${range.unit}. ${range.context_note}`;
  } else if (value > range.high) {
    position = 'above_range';
    summary = `${value} ${range.unit} is above the commonly observed range of ${range.low}–${range.high} ${range.unit}. ${range.context_note}`;
  } else {
    position = 'within_range';
    summary = `${value} ${range.unit} falls within the commonly observed range of ${range.low}–${range.high} ${range.unit}. ${range.context_note}`;
  }

  return {
    range_key: rangeKey,
    extracted_value: value,
    unit: range.unit,
    position,
    range_low: range.low,
    range_high: range.high,
    summary,
    non_authoritative_label: range.non_authoritative_label,
  };
}

/**
 * Determines the appropriate range key for a clause's key_numbers.
 * Returns null if no range comparison is applicable.
 *
 * @param clauseType - The clause type from the analysis schema
 * @param key_numbers - The extracted numeric values for the clause
 * @returns Array of comparison results (may be empty if no numeric data)
 */
export function buildRangeComparisonsForClause(
  clauseType: string,
  key_numbers: {
    duration_months: number | null;
    amount_inr: number | null;
    notice_days: number | null;
  }
): RangeComparisonResult[] {
  const results: RangeComparisonResult[] = [];

  switch (clauseType) {
    case 'bond':
      if (key_numbers.duration_months !== null) {
        results.push(compareClauseValueToRange('bond_duration_months', key_numbers.duration_months));
      }
      if (key_numbers.amount_inr !== null) {
        results.push(compareClauseValueToRange('bond_penalty_inr', key_numbers.amount_inr));
      }
      break;

    case 'notice_period':
      if (key_numbers.notice_days !== null) {
        results.push(compareClauseValueToRange('notice_period_days', key_numbers.notice_days));
      }
      break;

    case 'probation':
      if (key_numbers.duration_months !== null) {
        results.push(compareClauseValueToRange('probation_duration_months', key_numbers.duration_months));
      }
      break;

    case 'non_compete':
    case 'ip_assignment':
    case 'general':
    default:
      // No numeric ranges defined for these clause types
      break;
  }

  return results;
}

/**
 * Returns a short, display-ready label for a range position.
 * Used in UI badge rendering.
 */
export function getRangePositionLabel(position: RangePosition): string {
  const labels: Record<RangePosition, string> = {
    within_range: 'Within typical range',
    above_range: 'Above typical range',
    below_range: 'Below typical range',
    no_range_data: 'No comparison available',
  };
  return labels[position];
}
