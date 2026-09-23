import React from 'react';
import type { ConsequenceScenario } from '../logic/analysis_schema_validator';

interface ConsequenceScenarioPanelProps {
  scenarios: ConsequenceScenario[];
  clauseTitle: string;
}

export function ConsequenceScenarioPanel({ scenarios, clauseTitle }: ConsequenceScenarioPanelProps): React.ReactElement {
  return (
    <div aria-label={`Consequence scenarios for ${clauseTitle}`}>
      <div className="scenario-list">
        {scenarios.map((scenario, i) => (
          <div key={i} className="scenario-item">
            <p className="scenario-trigger-label">Trigger scenario</p>
            <p className="scenario-trigger-text">{scenario.trigger}</p>
            <div className="scenario-steps">
              {scenario.consequence_steps.map((step, j) => (
                <div key={j} className="scenario-step">
                  <span className="scenario-step-num">{j + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div className="scenario-footer">
              {scenario.financial_estimate && (
                <span className="scenario-estimate">Est. impact: {scenario.financial_estimate}</span>
              )}
              <span className={`outcome-badge ${scenario.outcome_likelihood}`}>
                {scenario.outcome_likelihood}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
