import React, { useState } from 'react';
import type { OfferClause } from '../logic/analysis_schema_validator';
import { StatuteCitationPanel } from './statute_citation_panel';
import { ConsequenceScenarioPanel } from './consequence_scenario_panel';
import { buildRangeComparisonsForClause, getRangePositionLabel } from '../logic/clause_range_comparator';
import { verifyQuoteInDocument } from '../logic/document_quote_verifier';
import { getClauseTypeLabel } from '../logic/clause_to_statute_matcher';

interface ClauseRiskCardProps {
  clause: OfferClause;
  documentText: string;
}

export function ClauseRiskCard({ clause, documentText }: ClauseRiskCardProps): React.ReactElement {
  const [statuteOpen, setStatuteOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);

  const quoteResult = verifyQuoteInDocument(clause.exact_quote ?? '', documentText);
  const rangeComparisons = clause.key_numbers
    ? buildRangeComparisonsForClause(clause.clause_type, clause.key_numbers)
    : [];

  const concernIcons: Record<string, string> = { significant: '⚠', moderate: '◈', minor: '✓' };

  const quoteStatusClass = quoteResult.quote_status === 'confirmed_in_document' ? 'confirmed'
    : quoteResult.quote_status === 'not_found_in_document' ? 'not-found' : 'not-addressed';

  const quoteStatusLabel = quoteResult.quote_status === 'confirmed_in_document' ? '✓ Verified in document'
    : quoteResult.quote_status === 'not_found_in_document' ? '⚠ Could not verify in document — review original'
    : '— Not addressed in document';

  return (
    <article className="clause-risk-card" data-concern={clause.concern_level} aria-label={`Clause: ${clause.title}`}>
      <div className="clause-card-header">
        <div className="clause-title-group">
          <span className="clause-type-badge">{getClauseTypeLabel(clause.clause_type)}</span>
          <h3>{clause.title}</h3>
          {clause.page_hint && (
            <span style={{ fontSize: 'var(--text-xs)', color: '#475569' }}>Page {clause.page_hint}</span>
          )}
        </div>
        <span className={`concern-badge ${clause.concern_level}`}>
          {concernIcons[clause.concern_level] ?? ''} {clause.concern_level}
        </span>
      </div>

      <p className="clause-plain-english">{clause.plain_english}</p>

      <div className="clause-rationale">{clause.concern_rationale}</div>

      {clause.exact_quote && (
        <div className="quote-verification">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className={`quote-status-badge ${quoteStatusClass}`}>{quoteStatusLabel}</span>
            {clause.page_hint && (
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "#94a3b8" }}>
                Page {clause.page_hint}
              </span>
            )}
          </div>
          <p className="quote-text">"{clause.exact_quote}"</p>
        </div>
      )}

      {clause.key_numbers && (
        <div className="key-numbers">
          {clause.key_numbers.duration_months != null && (
            <span className="key-number-chip">Duration: <span>{clause.key_numbers.duration_months} months</span></span>
          )}
          {clause.key_numbers.amount_inr != null && (
            <span className="key-number-chip">Amount: <span>₹{clause.key_numbers.amount_inr.toLocaleString('en-IN')}</span></span>
          )}
          {clause.key_numbers.notice_days != null && (
            <span className="key-number-chip">Notice: <span>{clause.key_numbers.notice_days} days</span></span>
          )}
        </div>
      )}

      {rangeComparisons.map((rc) => (
        <div key={rc.range_key} className="range-comparison">
          <span className={`range-badge ${rc.position}`}>{getRangePositionLabel(rc.position)}</span>
          <span>{rc.summary}</span>
          {rc.range_low != null && rc.range_high != null && (
            <span style={{ color: '#334155' }}>({rc.range_low}–{rc.range_high})</span>
          )}
        </div>
      ))}

      {rangeComparisons.length > 0 && (
        <p style={{ fontSize: 'var(--text-xs)', color: '#334155', marginTop: 'var(--space-2)' }}>
          {rangeComparisons[0].non_authoritative_label}
        </p>
      )}

      {clause.applicable_law.length > 0 && (
        <div className="expandable-panel">
          <button
            className="expandable-panel-trigger"
            aria-expanded={statuteOpen}
            aria-controls={`statute-panel-${clause.id}`}
            onClick={() => setStatuteOpen(!statuteOpen)}
            id={`statute-toggle-${clause.id}`}
          >
            <span>⚖ Indian Law References ({clause.applicable_law.length})</span>
            <span className="chevron">▼</span>
          </button>
          {statuteOpen && (
            <div className="expandable-panel-body" id={`statute-panel-${clause.id}`}>
              <StatuteCitationPanel applicableLaw={clause.applicable_law} clauseType={clause.clause_type} />
            </div>
          )}
        </div>
      )}

      {clause.consequence_scenarios.length > 0 && (
        <div className="expandable-panel">
          <button
            className="expandable-panel-trigger"
            aria-expanded={scenarioOpen}
            aria-controls={`scenario-panel-${clause.id}`}
            onClick={() => setScenarioOpen(!scenarioOpen)}
            id={`scenario-toggle-${clause.id}`}
          >
            <span>→ What happens if this clause is triggered? ({clause.consequence_scenarios.length})</span>
            <span className="chevron">▼</span>
          </button>
          {scenarioOpen && (
            <div className="expandable-panel-body" id={`scenario-panel-${clause.id}`}>
              <ConsequenceScenarioPanel scenarios={clause.consequence_scenarios} clauseTitle={clause.title} />
            </div>
          )}
        </div>
      )}
    </article>
  );
}
