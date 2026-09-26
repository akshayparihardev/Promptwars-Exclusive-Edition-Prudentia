import React, { useState } from 'react';
import type { OfferClause } from '../logic/analysis_schema_validator.js';
import { StatuteCitationPanel } from './statute_citation_panel.js';
import { ConsequenceScenarioPanel } from './consequence_scenario_panel.js';
import { buildRangeComparisonsForClause, getRangePositionLabel } from '../logic/clause_range_comparator.js';
import { verifyQuoteInDocument, verifyNumbers } from '../logic/document_quote_verifier.js';
import { getClauseTypeLabel } from '../logic/clause_to_statute_matcher.js';
import { IconAlertTriangle, IconInfo, IconCheck, IconChevronDown, IconScale, IconArrowRight, IconExternalLink } from './icons.js';

interface ClauseRiskCardProps {
  clause: OfferClause;
  documentText: string;
  onViewInDocument?: (page: number | undefined, quote: string) => void;
}

export function ClauseRiskCard({ clause, documentText, onViewInDocument }: ClauseRiskCardProps): React.ReactElement {
  const [statuteOpen, setStatuteOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);

  const quoteResult = verifyQuoteInDocument(clause.exact_quote ?? '', documentText);
  const rangeComparisons = clause.key_numbers
    ? buildRangeComparisonsForClause(clause.clause_type, clause.key_numbers)
    : [];

  const numberWarning = clause.key_numbers
    ? verifyNumbers(clause.exact_quote ?? '', clause.key_numbers)
    : null;

  const ConcernIcon = clause.concern_level === 'significant' ? IconAlertTriangle
    : clause.concern_level === 'moderate' ? IconInfo : IconCheck;

  const quoteStatusClass = quoteResult.quote_status === 'confirmed_in_document' ? 'confirmed'
    : quoteResult.quote_status === 'not_found_in_document' ? 'not-found' : 'not-addressed';

  const QuoteStatusIcon = quoteResult.quote_status === 'confirmed_in_document' ? IconCheck
    : quoteResult.quote_status === 'not_found_in_document' ? IconAlertTriangle : null;

  const quoteStatusLabel = quoteResult.quote_status === 'confirmed_in_document' ? 'Verified in document'
    : quoteResult.quote_status === 'not_found_in_document' ? 'Could not verify in document — review original'
    : 'Not addressed in document';

  return (
    <article className="clause-risk-card" data-concern={clause.concern_level} aria-label={`Clause: ${clause.title}`}>
      <div className="clause-card-header">
        <div className="clause-title-group">
          <span className="clause-type-badge">{getClauseTypeLabel(clause.clause_type)}</span>
          <h3>{clause.title}</h3>
          {clause.page_hint && (
            <span className="clause-page-hint">Page {clause.page_hint}</span>
          )}
        </div>
        <span className={`concern-badge ${clause.concern_level}`}>
          <ConcernIcon size={12} /> {clause.concern_level}
        </span>
      </div>

      <p className="clause-plain-english">{clause.plain_english}</p>

      <div className="clause-rationale">{clause.concern_rationale}</div>

      {clause.exact_quote && (
        <div className="quote-verification">
          <div className="quote-verification-row">
            <span className={`quote-status-badge ${quoteStatusClass}`}>
              {QuoteStatusIcon && <QuoteStatusIcon size={13} />} {quoteStatusLabel}
            </span>
            {clause.page_hint && (
              <span className="quote-page-ref">Page {clause.page_hint}</span>
            )}
          </div>
          <p className="quote-text">&ldquo;{clause.exact_quote}&rdquo;</p>
          {onViewInDocument && (
            <button
              className="btn-secondary"
              style={{ marginTop: 'var(--space-3)' }}
              onClick={() => onViewInDocument(clause.page_hint ?? undefined, clause.exact_quote!)}
            >
              <IconExternalLink size={13} /> View in document
            </button>
          )}
          {numberWarning && (
            <p className="quote-number-warning">
              <IconInfo size={13} /> {numberWarning}
            </p>
          )}
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
            <span>({rc.range_low}–{rc.range_high})</span>
          )}
        </div>
      ))}

      {rangeComparisons.length > 0 && (
        <p className="range-comparison-note">
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
            <span className="expandable-panel-trigger-label"><IconScale size={14} /> Indian Law References ({clause.applicable_law.length})</span>
            <span className="chevron"><IconChevronDown size={14} /></span>
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
            <span className="expandable-panel-trigger-label"><IconArrowRight size={14} /> What happens if this clause is triggered? ({clause.consequence_scenarios.length})</span>
            <span className="chevron"><IconChevronDown size={14} /></span>
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
