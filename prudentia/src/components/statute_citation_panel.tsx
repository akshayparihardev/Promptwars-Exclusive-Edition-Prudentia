/**
 * statute_citation_panel.tsx
 *
 * Expandable panel that shows the full statute text and relevance note for each
 * applicable_law entry on a clause. Enables the "one click to verify" requirement.
 *
 * Functional only — no styling yet.
 */

import React, { useState } from 'react';
import { INDIAN_STATUTE_REFERENCE } from '../data/indian_statute_reference';
import type { StatuteKey } from '../data/indian_statute_reference';

interface StatuteCitationPanelProps {
  /** The applicable_law entries from the clause — each has act and section. */
  applicableLaw: Array<{ act: string; section: string }>;
  /** The clause type — used to look up the correct statute keys. */
  clauseId: string;
}

/**
 * Maps act + section strings back to statute keys for the reference lookup.
 * This is deterministic — no AI involved.
 */
function findStatuteKey(act: string, section: string): StatuteKey | null {
  const entries = Object.entries(INDIAN_STATUTE_REFERENCE) as Array<
    [StatuteKey, (typeof INDIAN_STATUTE_REFERENCE)[StatuteKey]]
  >;
  const match = entries.find(
    ([, entry]) =>
      entry.act.toLowerCase() === act.toLowerCase() &&
      entry.section === section
  );
  return match ? match[0] : null;
}

export function StatuteCitationPanel({
  applicableLaw,
  clauseId,
}: StatuteCitationPanelProps): React.ReactElement | null {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (applicableLaw.length === 0) return null;

  return (
    <div id={`statute-panel-${clauseId}`} aria-label="Applicable statute citations">
      <h4>Applicable Indian Law</h4>
      <p>
        <small>
          These statutes were deterministically matched to this clause type — not guessed by the AI.
          Click any citation to read the relevant section.
        </small>
      </p>

      {applicableLaw.map((law) => {
        const key = findStatuteKey(law.act, law.section);
        const entry = key ? INDIAN_STATUTE_REFERENCE[key] : null;
        const panelKey = `${law.act}-${law.section}`;
        const isExpanded = expandedKey === panelKey;

        return (
          <div key={panelKey} id={`statute-entry-${clauseId}-${panelKey.replace(/\s+/g, '-')}`}>
            <button
              id={`statute-toggle-${clauseId}-${panelKey.replace(/\s+/g, '-')}`}
              aria-expanded={isExpanded}
              aria-controls={`statute-text-${panelKey.replace(/\s+/g, '-')}`}
              onClick={() => setExpandedKey(isExpanded ? null : panelKey)}
            >
              {law.act}, Section {law.section}
              {entry ? ` — "${entry.title}"` : ''}
              {isExpanded ? ' ▲' : ' ▼'}
            </button>

            {isExpanded && (
              <div
                id={`statute-text-${panelKey.replace(/\s+/g, '-')}`}
                role="region"
                aria-label={`Full text of ${law.act} Section ${law.section}`}
              >
                {entry ? (
                  <>
                    <blockquote>
                      <p>{entry.text}</p>
                    </blockquote>
                    <p>
                      <strong>Why this applies here:</strong> {entry.relevance_note}
                    </p>
                    <p>
                      <small>
                        Sources:{' '}
                        {entry.source_urls.map((url, i) => (
                          <React.Fragment key={url}>
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              {i === 0 ? 'indiacode.nic.in' : 'indiankanoon.org'}
                            </a>
                            {i < entry.source_urls.length - 1 ? ' · ' : ''}
                          </React.Fragment>
                        ))}
                      </small>
                    </p>
                  </>
                ) : (
                  <p>
                    {law.act}, Section {law.section} — full text not in local reference. Verify at{' '}
                    <a
                      href={`https://indiankanoon.org/search/?formInput=${encodeURIComponent(law.act + ' section ' + law.section)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      indiankanoon.org
                    </a>
                    .
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
