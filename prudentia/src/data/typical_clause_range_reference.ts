/**
 * typical_clause_range_reference.ts
 *
 * Illustrative observed-practice ranges for common employment clause numeric values
 * in the Indian tech/service sector.
 *
 * ⚠️ CRITICAL NON-AUTHORITATIVE LABEL ⚠️
 * These values are derived from observed industry practice and publicly available
 * compensation/HR surveys. They are NOT legal standards, NOT statutory requirements,
 * and NOT legal advice. They serve only as a rough contextual reference to help a
 * first-time offer-letter reader understand whether a number is unusually high or low
 * compared to common practice.
 *
 * Every UI surface and export that references these ranges MUST display the non_authoritative_label.
 * These ranges MUST NEVER be presented with the same confidence level as applicable_law citations.
 */

export interface ClauseRange {
  low: number;
  high: number;
  unit: string;
  /** Displayed verbatim wherever this range is shown — mandatory disclaimer. */
  non_authoritative_label: string;
  /** Additional context for the user — displayed alongside the range. */
  context_note: string;
}

export const TYPICAL_RANGES: Record<string, ClauseRange> = {
  bond_duration_months: {
    low: 12,
    high: 24,
    unit: 'months',
    non_authoritative_label:
      'Observed practice only — not a legal standard. Your specific situation may differ.',
    context_note:
      'Commonly observed range in Indian tech/service sector offers. Bonds shorter than 12 months are rare; bonds longer than 24 months are uncommon for entry-level roles and may attract higher scrutiny.',
  },

  notice_period_days: {
    low: 30,
    high: 90,
    unit: 'days',
    non_authoritative_label:
      'Observed practice only — not a legal standard. Your specific situation may differ.',
    context_note:
      'Commonly observed range in Indian tech/service sector. Entry-level roles typically see 30–60 days; senior roles may extend to 90 days or beyond. Shorter than 30 days is unusual; longer than 90 days for junior roles is worth clarifying.',
  },

  bond_penalty_inr: {
    low: 50000,
    high: 300000,
    unit: '₹',
    non_authoritative_label:
      'Observed practice only — not a legal standard. Actual enforceability depends on ICA Section 74 (reasonable compensation, not automatic full amount).',
    context_note:
      'Commonly observed bond penalty range. Under ICA Section 74, courts assess reasonableness — a stated penalty does not mean the full amount will be awarded.',
  },

  probation_duration_months: {
    low: 3,
    high: 6,
    unit: 'months',
    non_authoritative_label:
      'Observed practice only — not a legal standard. Your specific situation may differ.',
    context_note:
      'Most Indian tech companies use a 3–6 month probation period. Probation periods longer than 6 months for standard roles are uncommon and worth clarifying.',
  },
};

/** All valid range keys — use for type-safe lookups. */
export type RangeKey = keyof typeof TYPICAL_RANGES;
