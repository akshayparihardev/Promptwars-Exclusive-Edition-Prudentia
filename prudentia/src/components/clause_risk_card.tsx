/**
 * clause_risk_card.tsx
 *
 * Displays a single clause from the analysis — the core unit of the results view.
 *
 * Shows:
 *   - exact_quote (verbatim, with page hint)
 *   - plain_english explanation
 *   - concern_level badge
 *   - concern_rationale (references applicable law)
 *   - key_numbers with range comparison (non-authoritative label mandatory)
 *   - statute_citation_panel (expandable)
 *   - consequence_scenario_panel (expandable)
 *
 * Functional only — no styling yet.
 */

import React from 'react';
import type { OfferClause } from '../logic/analysis_schema_validator';
import { getClauseTypeLabel } from '../logic/clause_to_statute_matcher';
import type { ClauseType } from '../logic/clause_to_statute_matcher';
import { buildRangeComparisonsForClause, getRangePositionLabel } from '../logic/clause_range_comparator';
import { StatuteCitationPanel } from './statute_citation_panel';
import { ConsequenceScenarioPanel } from './consequence_scenario_panel';

interface ClauseRiskCardProps {
  clause: OfferClause;
  /** Index for display (1-based). */
  index: number;
}

function ConcernLevelBadge({ level }: { level: OfferClause['concern_level'] }): React.ReactElement {
  const labels: Record<OfferClause['concern_level'], string> = {
    minor: 'Minor concern',
    moderate: 'Moderate concern',
    significant: 'Significant concern',
  };
  return (
    <span
      id={`concern-badge-${level}`}
      role="status"
      aria-label={`Risk level: ${labels[level]}`}
    >
      {labels[level].toUpperCase()}
    </span>
  );
}

function KeyNumbersDisplay({ clause }: { clause: OfferClause }): React.ReactElement | null {
  const { duration_months, amount_inr, notice_days } = clause.key_numbers;
  const hasNumbers = duration_months !== null || amount_inr !== null || notice_days !== null;

  if (!hasNumbers) return null;

  const rangeComparisons = buildRangeComparisonsForClause(clause.clause_type, clause.key_numbers);

  return (
    <div aria-label="Key numeric values in this clause">
      <strong>Key numbers:</strong>
      <ul>
        {duration_months !== null && <li>Duration: {duration_months} months</li>}
        {amount_inr !== null && (
          <li>Amount: ₹{amount_inr.toLocaleString('en-IN')}</li>
        )}
        {notice_days !== null && <li>Notice period: {notice_days} days</li>}
      </ul>

      {rangeComparisons.length > 0 && (
        <div aria-label="Comparison against observed practice ranges">
          <strong>Compared to typical practice (non-authoritative):</strong>
          {rangeComparisons.map((comparison, i) => (
            <div key={i} id={`range-comparison-${clause.id}-${i}`}>
              <span aria-label={`Range position: ${getRangePositionLabel(comparison.position)}`}>
                {getRangePositionLabel(comparison.position)}
              </span>
              <p>{comparison.summary}</p>
              <small>
                ⚠ {comparison.non_authoritative_label}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClauseRiskCard({
  clause,
  index,
}: ClauseRiskCardProps): React.ReactElement {
  return (
    <article
      id={`clause-card-${clause.id}`}
      aria-labelledby={`clause-title-${clause.id}`}
      data-concern-level={clause.concern_level}
      data-clause-type={clause.clause_type}
    >
      <header>
        <h3 id={`clause-title-${clause.id}`}>
          {index}. {clause.title}
        </h3>
        <ConcernLevelBadge level={clause.concern_level} />
        <span aria-label={`Clause type: ${getClauseTypeLabel(clause.clause_type as ClauseType)}`}>
          {getClauseTypeLabel(clause.clause_type as ClauseType)}
        </span>
        {clause.page_hint && (
          <span aria-label={`Approximately page ${clause.page_hint}`}>
            ~Page {clause.page_hint}
          </span>
        )}
      </header>

      {/* Verbatim quote from document — satisfies "exact clause + page reference" requirement */}
      <section aria-label="Exact quote from document">
        <h4>Exact quote from your document</h4>
        <blockquote
          id={`exact-quote-${clause.id}`}
          cite={clause.page_hint ? `Page ${clause.page_hint}` : undefined}
        >
          {clause.exact_quote}
        </blockquote>
        {clause.page_hint && (
          <cite>Source: approximately page {clause.page_hint} of your document</cite>
        )}
      </section>

      {/* Plain English explanation */}
      <section aria-label="Plain language explanation">
        <h4>What this means</h4>
        <p>{clause.plain_english}</p>
      </section>

      {/* Key numbers + range comparison */}
      <KeyNumbersDisplay clause={clause} />

      {/* Concern rationale — must reference applicable law, not bare opinion */}
      <section aria-label="Why this is flagged">
        <h4>Why this is flagged</h4>
        <p>{clause.concern_rationale}</p>
      </section>

      {/* Expandable statute citations */}
      <StatuteCitationPanel
        applicableLaw={clause.applicable_law}
        clauseId={clause.id}
      />

      {/* Expandable consequence scenarios */}
      <ConsequenceScenarioPanel
        clauseId={clause.id}
        clauseType={clause.clause_type}
        scenarios={clause.consequence_scenarios}
      />
    </article>
  );
}
