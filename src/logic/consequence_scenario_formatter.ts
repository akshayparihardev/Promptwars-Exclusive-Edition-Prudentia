/**
 * consequence_scenario_formatter.ts
 *
 * Formats ConsequenceScenario objects from the analysis into human-readable structures
 * for display in the consequence_scenario_panel component.
 *
 * Responsibilities:
 *   - Convert raw consequence_scenarios data into display-ready objects
 *   - Apply calibrated language wrappers (never certainty — always "may", "could", "typically")
 *   - Format financial estimates with appropriate caveats (ICA §74 reasonableness note)
 *   - Generate outcome_likelihood badges with correct visual treatment
 *
 * This module does NOT generate new scenarios — it only formats existing ones from the
 * validated analysis output. Scenario content comes from Gemini; formatting is deterministic.
 */

import type { ConsequenceScenario } from './analysis_schema_validator.js';

/** Display-ready consequence scenario with all fields formatted for the UI. */
export interface FormattedConsequenceScenario {
  /** Original trigger description, unchanged. */
  trigger: string;
  /** Steps formatted as an ordered list with calibrated language prefixes. */
  formatted_steps: Array<{
    step_number: number;
    text: string;
  }>;
  /** Financial estimate with automatic ICA §74 caveat appended if relevant. */
  formatted_financial_estimate: string | null;
  /** The raw outcome_likelihood value. */
  outcome_likelihood: 'probable' | 'possible' | 'uncertain';
  /** Human-readable label for the outcome_likelihood badge. */
  likelihood_label: string;
  /** Short description of what the likelihood means — shown in tooltip. */
  likelihood_description: string;
  /** CSS-style severity class for badge coloring — values: 'high' | 'medium' | 'low'. */
  likelihood_severity: 'high' | 'medium' | 'low';
}

/** Full formatted output for a clause's consequence scenarios. */
export interface FormattedClauseScenarios {
  clause_id: string;
  clause_type: string;
  scenarios: FormattedConsequenceScenario[];
  /** True if any scenario has outcome_likelihood 'probable'. */
  has_probable_outcome: boolean;
  /** Summary sentence for collapsed/preview state. */
  preview_text: string;
}

// ─── Outcome likelihood helpers ───────────────────────────────────────────────

function getLikelihoodLabel(likelihood: ConsequenceScenario['outcome_likelihood']): string {
  const labels: Record<ConsequenceScenario['outcome_likelihood'], string> = {
    probable: 'Likely outcome',
    possible: 'Possible outcome',
    uncertain: 'Uncertain — depends on circumstances',
  };
  return labels[likelihood];
}

function getLikelihoodDescription(likelihood: ConsequenceScenario['outcome_likelihood']): string {
  const descriptions: Record<ConsequenceScenario['outcome_likelihood'], string> = {
    probable:
      'Courts and industry practice commonly produce this outcome when this clause is triggered. This does not guarantee it will happen in your specific case.',
    possible:
      'This outcome can occur but is not the most common result — it depends on factors like the specific wording, employer conduct, and jurisdiction.',
    uncertain:
      'Legal outcomes in this scenario are difficult to predict without professional legal advice. Multiple factors could significantly change the result.',
  };
  return descriptions[likelihood];
}

function getLikelihoodSeverity(
  likelihood: ConsequenceScenario['outcome_likelihood']
): 'high' | 'medium' | 'low' {
  const map: Record<ConsequenceScenario['outcome_likelihood'], 'high' | 'medium' | 'low'> = {
    probable: 'high',
    possible: 'medium',
    uncertain: 'low',
  };
  return map[likelihood];
}

// ─── Financial estimate formatter ─────────────────────────────────────────────

/**
 * Formats a financial_estimate string, appending ICA §74 reasonableness caveat
 * for bond/penalty scenarios where courts assess actual loss.
 *
 * @param estimate - Raw financial_estimate string from the analysis
 * @param clauseType - The clause type (bond clauses get the §74 caveat)
 * @returns Formatted string with caveat, or null if estimate is null
 */
function formatFinancialEstimate(
  estimate: string | null,
  clauseType: string
): string | null {
  if (!estimate) return null;

  const bondTypes = ['bond'];
  const ica74Caveat =
    ' (Note: Indian courts assess "reasonable compensation" under ICA §74 — the full stated amount may not be automatically awarded.)';

  if (bondTypes.includes(clauseType) && !estimate.includes('§74')) {
    return `${estimate}${ica74Caveat}`;
  }

  return estimate;
}

// ─── Step formatter ───────────────────────────────────────────────────────────

/**
 * Formats consequence steps with step numbers.
 * The AI already uses calibrated language per the system prompt — this function
 * does not add additional hedging to avoid over-qualifying.
 */
function formatSteps(
  steps: string[]
): Array<{ step_number: number; text: string }> {
  return steps.map((step, index) => ({
    step_number: index + 1,
    text: step,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Formats a single ConsequenceScenario for display.
 *
 * @param scenario - Raw scenario from validated analysis output
 * @param clauseType - The parent clause type (affects financial estimate formatting)
 * @returns FormattedConsequenceScenario ready for rendering
 */
export function formatConsequenceScenario(
  scenario: ConsequenceScenario,
  clauseType: string
): FormattedConsequenceScenario {
  return {
    trigger: scenario.trigger,
    formatted_steps: formatSteps(scenario.consequence_steps),
    formatted_financial_estimate: formatFinancialEstimate(scenario.financial_estimate, clauseType),
    outcome_likelihood: scenario.outcome_likelihood,
    likelihood_label: getLikelihoodLabel(scenario.outcome_likelihood),
    likelihood_description: getLikelihoodDescription(scenario.outcome_likelihood),
    likelihood_severity: getLikelihoodSeverity(scenario.outcome_likelihood),
  };
}

/**
 * Formats all consequence scenarios for a single clause.
 *
 * @param clauseId - The clause's id field (for cross-referencing in the UI)
 * @param clauseType - The clause type (e.g., 'bond', 'notice_period')
 * @param scenarios - Array of raw ConsequenceScenario objects
 * @returns FormattedClauseScenarios with preview text and probability summary
 */
export function formatClauseScenarios(
  clauseId: string,
  clauseType: string,
  scenarios: ConsequenceScenario[]
): FormattedClauseScenarios {
  const formatted = scenarios.map((s) => formatConsequenceScenario(s, clauseType));
  const hasProbable = formatted.some((s) => s.outcome_likelihood === 'probable');

  // Build preview text from the first scenario's trigger
  const previewText =
    formatted.length === 0
      ? 'No specific scenarios identified for this clause.'
      : formatted.length === 1
        ? `If triggered: ${formatted[0].trigger.toLowerCase()}`
        : `${formatted.length} scenarios identified — see what happens if this clause is triggered.`;

  return {
    clause_id: clauseId,
    clause_type: clauseType,
    scenarios: formatted,
    has_probable_outcome: hasProbable,
    preview_text: previewText,
  };
}

/**
 * Returns a plain-text summary of all scenarios for a clause.
 * Used in the lawyer consultation export — no HTML formatting.
 */
export function buildScenariosExportText(scenarios: FormattedConsequenceScenario[]): string {
  if (scenarios.length === 0) return 'No specific scenarios identified.';

  return scenarios
    .map((s, i) => {
      const lines = [
        `Scenario ${i + 1}: ${s.trigger}`,
        `Likelihood: ${s.likelihood_label}`,
        `Steps:`,
        ...s.formatted_steps.map((step) => `  ${step.step_number}. ${step.text}`),
      ];
      if (s.formatted_financial_estimate) {
        lines.push(`Financial estimate: ${s.formatted_financial_estimate}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}
