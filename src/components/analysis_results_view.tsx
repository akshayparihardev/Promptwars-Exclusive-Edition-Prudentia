import React, { useState } from 'react';
import type { OfferLetterAnalysis } from '../logic/analysis_schema_validator.js';
import { ClauseRiskCard } from './clause_risk_card.js';
import { LawyerConsultationExportButton } from './lawyer_consultation_export_button.js';
import type { QAEntry } from '../hooks/use_document_analysis.js';

interface AnalysisResultsViewProps {
  analysis: OfferLetterAnalysis;
  fileName: string | null;
  /** Independently extracted PDF text for quote verification (PDF.js) */
  extractedPdfText: string;
  qaHistory: QAEntry[];
  onAskQuestion: (q: string) => void;
  onReset: () => void;
  onViewInDocument?: (page: number | undefined, quote: string) => void;
}

export function AnalysisResultsView({ analysis, fileName, extractedPdfText, qaHistory, onAskQuestion, onReset, onViewInDocument }: AnalysisResultsViewProps): React.ReactElement {
  const [qaInput, setQaInput] = useState('');

  const handleQaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = qaInput.trim();
    if (q) { onAskQuestion(q); setQaInput(''); }
  };

  const s = analysis.offer_summary;

  // Use independently extracted PDF text (from PDF.js) for quote verification.
  // This is architecturally critical: we verify Gemini's claims against text
  // parsed independently from the PDF, not against Gemini's own output.
  // Falls back to concatenated LLM quotes if PDF.js extraction failed.
  const fallbackQuoteText = analysis.clauses
    .map((c) => c.exact_quote)
    .filter(Boolean)
    .join(' ');
  const documentText = extractedPdfText || fallbackQuoteText;

  return (
    <div id="prudentia-results-view">
      <header>
        <h1>Prudentia — Analysis Complete</h1>
        <div className="results-meta">
          {fileName && <span className="results-filename">File: {fileName}</span>}
          <span className={`overall-concern ${analysis.overall_concern_level}`}>
            {analysis.overall_concern_level === 'significant' ? '⚠ ' : analysis.overall_concern_level === 'moderate' ? '◈ ' : '✓ '}
            {analysis.overall_concern_level} concern
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={onReset} id="analyse-different-btn">Analyse a different document</button>
          <LawyerConsultationExportButton analysis={analysis} fileName={fileName} />
        </div>
      </header>

      <p id="analysis-disclaimer"><strong>Reminder:</strong> {analysis.disclaimer}</p>

      {!analysis.is_offer_letter ? (
        <div id="not-offer-letter-notice">
          <h2>This document does not appear to be an employment offer letter.</h2>
          <p>Document type detected: {analysis.document_type}</p>
          <p style={{ marginTop: '0.75rem' }}>Please upload an employment offer letter for analysis.</p>
        </div>
      ) : (
        <>
          {s && (
            <section id="offer-summary" aria-label="Offer summary">
              <h2>Offer Summary</h2>
              <div className="offer-summary-grid">
                <div className="offer-summary-item">
                  <span className="offer-summary-label">Company</span>
                  <span className={`offer-summary-value${!s.company ? ' not-found' : ''}`}>{s.company ?? 'Not stated'}</span>
                </div>
                <div className="offer-summary-item">
                  <span className="offer-summary-label">Role</span>
                  <span className={`offer-summary-value${!s.role ? ' not-found' : ''}`}>{s.role ?? 'Not stated'}</span>
                </div>
                <div className="offer-summary-item">
                  <span className="offer-summary-label">CTC / Compensation</span>
                  <span className={`offer-summary-value${!s.ctc ? ' not-found' : ''}`}>{s.ctc ?? 'Not stated'}</span>
                </div>
                <div className="offer-summary-item">
                  <span className="offer-summary-label">Joining Date</span>
                  <span className={`offer-summary-value${!s.joining_date ? ' not-found' : ''}`}>{s.joining_date ?? 'Not stated'}</span>
                </div>
              </div>
            </section>
          )}

          <section id="clauses-section" aria-label="Clause risk analysis">
            <h2>{analysis.clauses.length} clause{analysis.clauses.length !== 1 ? 's' : ''} identified</h2>
            {analysis.clauses.map((clause) => (
              <ClauseRiskCard key={clause.id} clause={clause} documentText={documentText} onViewInDocument={onViewInDocument} />
            ))}
          </section>

          {analysis.unanswered_questions.length > 0 && (
            <section id="unanswered-questions" aria-label="Unanswered questions">
              <h2>⚠ Information Not Found in Document</h2>
              <ul>
                {analysis.unanswered_questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </section>
          )}

          <section id="qa-section" aria-label="Ask a question">
            <h2>Ask about this document</h2>
            {qaHistory.length > 0 && (
              <div className="qa-history" aria-live="polite">
                {qaHistory.map((item, i) => (
                  <div key={i}>
                    <p className="qa-item-question">{item.question}</p>
                    {item.qa_status === 'not_addressed_in_document' ? (
                      <p
                        className="qa-item-not-addressed"
                        role="status"
                        aria-label="Not enough information provided"
                      >
                        🔍 Not enough information provided — this topic is not addressed in the uploaded document.
                      </p>
                    ) : item.qa_status === 'processing' ? (
                      <p className="qa-item-answer" style={{ color: '#475569', fontStyle: 'italic' }}>Looking up...</p>
                    ) : (
                      <p className="qa-item-answer">{item.answer}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <form className="qa-form" onSubmit={handleQaSubmit} aria-label="Question form">
              <input
                id="qa-input"
                className="qa-input"
                type="text"
                value={qaInput}
                onChange={(e) => setQaInput(e.target.value)}
                placeholder="e.g. What happens if I break the bond early?"
                aria-label="Type your question about the offer letter"
              />
              <button className="btn btn-primary" type="submit" id="qa-submit-btn" disabled={!qaInput.trim()}>Ask</button>
            </form>
          </section>

          <div id="export-section">
            <p>Generate a structured document to bring to a qualified Indian labour law practitioner.</p>
            <LawyerConsultationExportButton analysis={analysis} fileName={fileName} />
          </div>
        </>
      )}
    </div>
  );
}
