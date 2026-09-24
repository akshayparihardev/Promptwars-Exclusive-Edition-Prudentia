/**
 * Tests for consequence_scenario_formatter.ts
 * Validates scenario formatting, likelihood badges, financial estimate caveats,
 * and export text generation.
 */

import { describe, it, expect } from 'vitest';
import {
  formatConsequenceScenario,
  formatClauseScenarios,
  buildScenariosExportText,
} from '../src/logic/consequence_scenario_formatter';
import type { ConsequenceScenario } from '../src/logic/analysis_schema_validator';

const SAMPLE_SCENARIO: ConsequenceScenario = {
  trigger: 'Employee resigns before completing 18 months.',
  consequence_steps: [
    'Company demands payment of INR 2,00,000.',
    'Employee may dispute under ICA §74.',
    'Court awards reasonable compensation.',
  ],
  financial_estimate: 'Up to INR 2,00,000',
  outcome_likelihood: 'possible',
};

describe('formatConsequenceScenario', () => {
  it('preserves the trigger text unchanged', () => {
    const r = formatConsequenceScenario(SAMPLE_SCENARIO, 'bond');
    expect(r.trigger).toBe(SAMPLE_SCENARIO.trigger);
  });

  it('numbers steps starting from 1', () => {
    const r = formatConsequenceScenario(SAMPLE_SCENARIO, 'bond');
    expect(r.formatted_steps[0].step_number).toBe(1);
    expect(r.formatted_steps[2].step_number).toBe(3);
  });

  it('preserves all step texts', () => {
    const r = formatConsequenceScenario(SAMPLE_SCENARIO, 'bond');
    expect(r.formatted_steps.map((s) => s.text)).toEqual(SAMPLE_SCENARIO.consequence_steps);
  });

  it('appends ICA §74 caveat for bond clauses', () => {
    const r = formatConsequenceScenario(SAMPLE_SCENARIO, 'bond');
    expect(r.formatted_financial_estimate).toContain('§74');
  });

  it('does NOT append §74 caveat for non-bond clauses', () => {
    const r = formatConsequenceScenario(SAMPLE_SCENARIO, 'notice_period');
    expect(r.formatted_financial_estimate).not.toContain('§74');
  });

  it('does NOT double-append §74 if already present', () => {
    const withCaveat = { ...SAMPLE_SCENARIO, financial_estimate: 'Under ICA §74, up to 2L' };
    const r = formatConsequenceScenario(withCaveat, 'bond');
    const count = (r.formatted_financial_estimate?.match(/§74/g) || []).length;
    expect(count).toBe(1);
  });

  it('returns null for null financial_estimate', () => {
    const noFinancial = { ...SAMPLE_SCENARIO, financial_estimate: null };
    const r = formatConsequenceScenario(noFinancial, 'bond');
    expect(r.formatted_financial_estimate).toBeNull();
  });

  it('maps probable to high severity', () => {
    const s = { ...SAMPLE_SCENARIO, outcome_likelihood: 'probable' as const };
    const r = formatConsequenceScenario(s, 'bond');
    expect(r.likelihood_severity).toBe('high');
  });

  it('maps possible to medium severity', () => {
    const r = formatConsequenceScenario(SAMPLE_SCENARIO, 'bond');
    expect(r.likelihood_severity).toBe('medium');
  });

  it('maps uncertain to low severity', () => {
    const s = { ...SAMPLE_SCENARIO, outcome_likelihood: 'uncertain' as const };
    const r = formatConsequenceScenario(s, 'bond');
    expect(r.likelihood_severity).toBe('low');
  });

  it('returns human-readable likelihood labels', () => {
    const r = formatConsequenceScenario(SAMPLE_SCENARIO, 'bond');
    expect(r.likelihood_label.length).toBeGreaterThan(5);
    expect(r.likelihood_description.length).toBeGreaterThan(20);
  });
});

describe('formatClauseScenarios', () => {
  it('sets has_probable_outcome when any scenario is probable', () => {
    const s = [
      { ...SAMPLE_SCENARIO, outcome_likelihood: 'probable' as const },
      { ...SAMPLE_SCENARIO, outcome_likelihood: 'uncertain' as const },
    ];
    const r = formatClauseScenarios('clause_1', 'bond', s);
    expect(r.has_probable_outcome).toBe(true);
  });

  it('sets has_probable_outcome to false when none are probable', () => {
    const r = formatClauseScenarios('clause_1', 'bond', [SAMPLE_SCENARIO]);
    expect(r.has_probable_outcome).toBe(false);
  });

  it('generates preview text for single scenario', () => {
    const r = formatClauseScenarios('clause_1', 'bond', [SAMPLE_SCENARIO]);
    expect(r.preview_text).toContain('triggered');
  });

  it('generates count-based preview for multiple scenarios', () => {
    const r = formatClauseScenarios('clause_1', 'bond', [SAMPLE_SCENARIO, SAMPLE_SCENARIO]);
    expect(r.preview_text).toContain('2 scenarios');
  });

  it('generates empty-state preview for zero scenarios', () => {
    const r = formatClauseScenarios('clause_1', 'bond', []);
    expect(r.preview_text).toContain('No specific scenarios');
  });
});

describe('buildScenariosExportText', () => {
  it('returns empty-state text for no scenarios', () => {
    const r = buildScenariosExportText([]);
    expect(r).toContain('No specific scenarios');
  });

  it('includes trigger, likelihood, and steps in export', () => {
    const formatted = formatConsequenceScenario(SAMPLE_SCENARIO, 'bond');
    const r = buildScenariosExportText([formatted]);
    expect(r).toContain('Scenario 1');
    expect(r).toContain(SAMPLE_SCENARIO.trigger);
    expect(r).toContain('Likelihood');
  });

  it('includes financial estimate when present', () => {
    const formatted = formatConsequenceScenario(SAMPLE_SCENARIO, 'bond');
    const r = buildScenariosExportText([formatted]);
    expect(r).toContain('Financial estimate');
  });
});
