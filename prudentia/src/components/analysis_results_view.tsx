/**
 * analysis_results_view.tsx
 *
 * The main results screen. Displays the full OfferLetterAnalysis:
 *   1. Offer summary (company, role, CTC, joining date)
 *   2. Overall concern level
 *   3. One ClauseRiskCard per clause
 *   4. Q&A panel — with explicit "Not stated in this document" state
 *   5. Export button
 *
 * Click-efficiency target: < 40 clicks for full walkthrough.
 *   - All clauses visible immediately (no pagination required for typical offer letters)
 *   - Each section expandable in 1 click
 *   - Q&A answer appears immediately (no loading state for local answers)
 *   - Export in 1 click
 *
 * Functional only — no styling yet.
 */

import React, { useState, useRef } from 'react';
import type { OfferLetterAnalysis } from '../logic/analysis_schema_validator';
import { ClauseRiskCard } from './clause_risk_card';
import { LawyerConsultationExportButton } from './lawyer_consultation_export_button';
import type { QAEntry } from '../hooks/use_document_analysis';
import { getQuoteStatusLabel, getQuoteStatusDescription } from '../logic/document_quote_verifier';

interface AnalysisResultsViewProps {
  analysis: OfferLetterAnalysis;
  fileName: string | null;
  qaHistory: QAEntry[];
  onAskQuestion: (question: string) => void;
  onReset: () => void;
}

function OfferSummarySection({
  analysis,
}: {
  analysis: OfferLetterAnalysis;
}): React.ReactElement {
  return (
    <section id="offer-summary-section" aria-labelledby="offer-summary-heading">
      <h2 id="offer-summary-heading">Offer Summary</h2>
      <dl>
        <dt>Company</dt>
        <dd>{analysis.offer_summary.company ?? <em>Not stated in document</em>}</dd>
        <dt>Role</dt>
        <dd>{analysis.offer_summary.role ?? <em>Not stated in document</em>}</dd>
        <dt>CTC</dt>
        <dd>{analysis.offer_summary.ctc ?? <em>Not stated in document</em>}</dd>
        <dt>Joining Date</dt>
        <dd>{analysis.offer_summary.joining_date ?? <em>Not stated in document</em>}</dd>
      </dl>

      <p>
        <strong>Overall concern level:</strong>{' '}
        <span
          id="overall-concern-badge"
          role="status"
          aria-label={`Overall concern level: ${analysis.overall_concern_level}`}
          data-level={analysis.overall_concern_level}
        >
          {analysis.overall_concern_level.toUpperCase()}
        </span>
      </p>
    </section>
  );
}

function QAPanel({
  qaHistory,
  onAskQuestion,
}: {
  qaHistory: QAEntry[];
  onAskQuestion: (q: string) => void;
}): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputValue.trim();
    if (!q) return;
    onAskQuestion(q);
    setInputValue('');
    inputRef.current?.focus();
  };

  return (
    <section id="qa-panel-section" aria-labelledby="qa-panel-heading">
      <h2 id="qa-panel-heading">Ask a question about this offer letter</h2>
      <p>
        Ask about specific clauses, numbers, or terms. Questions are answered from the
        analysis — no additional data is sent to any server.
      </p>

      <form onSubmit={handleSubmit} aria-label="Question input form">
        <label htmlFor="qa-input">Your question:</label>
        <input
          ref={inputRef}
          id="qa-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="e.g. Is there a non-compete clause? What is the notice period?"
          aria-label="Type your question about the offer letter"
          autoComplete="off"
        />
        <button
          id="qa-submit-btn"
          type="submit"
          disabled={!inputValue.trim()}
          aria-label="Submit question"
        >
          Ask
        </button>
      </form>

      {qaHistory.length > 0 && (
        <div
          id="qa-history"
          aria-label="Question and answer history"
          aria-live="polite"
        >
          {qaHistory.map((entry, i) => (
            <div
              key={entry.timestamp}
              id={`qa-entry-${i}`}
              aria-label={`Question ${i + 1}`}
              data-qa-status={entry.qa_status}
            >
              <p>
                <strong>Q: {entry.question}</strong>
              </p>

              {entry.qa_status === 'processing' && (
                <p aria-busy="true">Looking up...</p>
              )}

              {/* ─── CRITICAL: "Not stated in this document" — must be visually distinct ─── */}
              {entry.qa_status === 'not_addressed_in_document' && (
                <div
                  id={`qa-not-addressed-${i}`}
                  role="status"
                  aria-label="This topic is not stated in the document"
                  data-state="not-addressed-in-document"
                >
                  <strong>— Not stated in this document</strong>
                  <p>
                    {entry.quote_verification?.explanation ??
                      'This topic is not mentioned anywhere in the offer letter.'}
                  </p>
                  <p>
                    <small>
                      This is meaningful information — consider asking the employer to address
                      this point explicitly before signing.
                    </small>
                  </p>
                </div>
              )}

              {entry.qa_status === 'answered' && entry.answer && (
                <div id={`qa-answer-${i}`}>
                  <p style={{ whiteSpace: 'pre-line' }}>{entry.answer}</p>
                  {entry.quote_verification && (
                    <p>
                      <small>
                        Verification:{' '}
                        <span
                          data-quote-status={entry.quote_verification.quote_status}
                          title={getQuoteStatusDescription(entry.quote_verification.quote_status)}
                        >
                          {getQuoteStatusLabel(entry.quote_verification.quote_status)}
                        </span>
                      </small>
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AnalysisResultsView({
  analysis,
  fileName,
  qaHistory,
  onAskQuestion,
  onReset,
}: AnalysisResultsViewProps): React.ReactElement {
  return (
    <div id="analysis-results-view">
      <header>
        <div>
          <h1>Prudentia — Analysis Complete</h1>
          {fileName && (
            <p aria-label={`Analysed file: ${fileName}`}>
              <small>File: {fileName}</small>
            </p>
          )}
        </div>
        <button
          id="analyze-new-document-btn"
          type="button"
          onClick={onReset}
          aria-label="Upload and analyse a different offer letter"
        >
          Analyse a different document
        </button>
      </header>

      <div role="alert" aria-label="Mandatory disclaimer">
        <p>
          <strong>Reminder:</strong> {analysis.disclaimer}
        </p>
      </div>

      {/* Not an offer letter — special state */}
      {!analysis.is_offer_letter && (
        <div
          id="not-offer-letter-notice"
          role="alert"
          aria-label="Document is not an offer letter"
        >
          <p>
            <strong>This document does not appear to be an employment offer letter.</strong>
          </p>
          <p>Document type detected: {analysis.document_type}</p>
          <p>Please upload an employment offer letter for analysis.</p>
        </div>
      )}

      {analysis.is_offer_letter && (
        <>
          <OfferSummarySection analysis={analysis} />

          <section id="clauses-section" aria-labelledby="clauses-heading">
            <h2 id="clauses-heading">
              Clause Analysis ({analysis.clauses.length} clause
              {analysis.clauses.length !== 1 ? 's' : ''} identified)
            </h2>

            {analysis.clauses.length === 0 ? (
              <p>No clauses requiring specific attention were identified in this document.</p>
            ) : (
              <div id="clauses-list" role="list" aria-label="List of analysed clauses">
                {analysis.clauses.map((clause, i) => (
                  <div key={clause.id} role="listitem">
                    <ClauseRiskCard clause={clause} index={i + 1} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Q&A Section */}
          <QAPanel qaHistory={qaHistory} onAskQuestion={onAskQuestion} />

          {/* Consultation questions — document-specific, never static */}
          {analysis.consultation_questions.length > 0 && (
            <section
              id="consultation-questions-section"
              aria-labelledby="consultation-questions-heading"
            >
              <h2 id="consultation-questions-heading">
                Questions to Raise with a Lawyer
              </h2>
              <p>
                <small>
                  These questions were generated from the specific contents of this offer letter —
                  not generic boilerplate.
                </small>
              </p>
              <ol aria-label="Document-specific consultation questions">
                {analysis.consultation_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </section>
          )}

          <LawyerConsultationExportButton analysis={analysis} />
        </>
      )}
    </div>
  );
}
