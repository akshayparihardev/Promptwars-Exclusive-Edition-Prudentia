import React from 'react';
import { INDIAN_STATUTE_REFERENCE } from '../data/indian_statute_reference';
import type { ApplicableLaw } from '../logic/analysis_schema_validator';
import type { ClauseType } from '../logic/clause_to_statute_matcher';
import { CLAUSE_TYPE_TO_STATUTE } from '../logic/clause_to_statute_matcher';

interface StatuteCitationPanelProps {
  applicableLaw: ApplicableLaw[];
  clauseType: ClauseType;
}

export function StatuteCitationPanel({ applicableLaw, clauseType }: StatuteCitationPanelProps): React.ReactElement {
  const statuteKeys = CLAUSE_TYPE_TO_STATUTE[clauseType] ?? [];

  return (
    <div className="statute-list" aria-label="Applicable Indian statutes">
      {applicableLaw.map((law, i) => {
        const matchingKey = statuteKeys.find((k) => {
          const entry = INDIAN_STATUTE_REFERENCE[k];
          return entry && entry.act === law.act && entry.section === law.section;
        });
        const fullEntry = matchingKey ? INDIAN_STATUTE_REFERENCE[matchingKey] : null;

        return (
          <div key={i} className="statute-entry">
            <div className="statute-header">
              <span className="statute-act-name">{law.act}</span>
              <span className="statute-section-badge">§ {law.section}</span>
            </div>
            {fullEntry && (
              <>
                {fullEntry.section_text && (
                  <p className="statute-text">"{fullEntry.section_text}"</p>
                )}
                {fullEntry.relevance_note && (
                  <p className="statute-relevance">{fullEntry.relevance_note}</p>
                )}
                {fullEntry.url && (
                  <a className="statute-link" href={fullEntry.url} target="_blank" rel="noopener noreferrer">
                    ↗ View on indiacode.nic.in
                  </a>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
