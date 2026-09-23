/**
 * consequence_scenario_panel.tsx
 *
 * Displays the consequence_scenarios for a single clause in an expandable panel.
 * Shows what happens if the clause is triggered — the "what-if simulator."
 *
 * Functional only — no styling yet.
 */

import React, { useState } from 'react';
import { formatClauseScenarios } from '../logic/consequence_scenario_formatter';
import type { ConsequenceScenario } from '../logic/analysis_schema_validator';

interface ConsequenceScenarioPanelProps {
  clauseId: string;
  clauseType: string;
  scenarios: ConsequenceScenario[];
}

export function ConsequenceScenarioPanel({
  clauseId,
  clauseType,
  scenarios,
}: ConsequenceScenarioPanelProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatted = formatClauseScenarios(clauseId, clauseType, scenarios);

  if (scenarios.length === 0) {
    return (
      <div id={`consequence-panel-${clauseId}`}>
        <p>No specific consequence scenarios identified for this clause.</p>
      </div>
    );
  }

  return (
    <div id={`consequence-panel-${clauseId}`}>
      <button
        id={`consequence-toggle-${clauseId}`}
        aria-expanded={isExpanded}
        aria-controls={`consequence-content-${clauseId}`}
        onClick={() => setIsExpanded((v) => !v)}
      >
        What happens if this clause is triggered? ({scenarios.length} scenario
        {scenarios.length !== 1 ? 's' : ''})
        {formatted.has_probable_outcome && ' — includes probable outcome'}
        {isExpanded ? ' ▲' : ' ▼'}
      </button>

      {!isExpanded && (
        <p id={`consequence-preview-${clauseId}`}>{formatted.preview_text}</p>
      )}

      {isExpanded && (
        <div
          id={`consequence-content-${clauseId}`}
          role="region"
          aria-label={`Consequence scenarios for clause ${clauseId}`}
        >
          {formatted.scenarios.map((scenario, index) => (
            <div
              key={index}
              id={`scenario-${clauseId}-${index}`}
            >
              <h5>
                Scenario {index + 1}: {scenario.trigger}
              </h5>

              <p>
                <strong>Likelihood:</strong> {scenario.likelihood_label}
                <br />
                <small>{scenario.likelihood_description}</small>
              </p>

              <ol aria-label="Steps that follow if this scenario occurs">
                {scenario.formatted_steps.map((step) => (
                  <li key={step.step_number}>{step.text}</li>
                ))}
              </ol>

              {scenario.formatted_financial_estimate && (
                <p>
                  <strong>Possible financial impact:</strong>{' '}
                  {scenario.formatted_financial_estimate}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
