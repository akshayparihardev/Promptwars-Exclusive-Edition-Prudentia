import React, { Suspense, useCallback, useState } from 'react';
import { useDocumentAnalysis } from './hooks/use_document_analysis.js';
import { DocumentUploadScreen } from './components/document_upload_screen.js';
import { AnalysisResultsView } from './components/analysis_results_view.js';
import { TwoPaneLayout } from './components/two_pane_layout.js';
import { AnalyzingState } from './components/analyzing_state.js';
import { IconAlertTriangle, IconRefresh } from './components/icons.js';

// pdfjs-dist (used by PdfViewer) is a large dependency (~37MB unpacked) only
// ever needed once analysis completes - lazy-loading it keeps it out of the
// main bundle and off the critical path for first paint / the upload screen.
const PdfViewer = React.lazy(() =>
  import('./components/pdf_viewer.js').then((m) => ({ default: m.PdfViewer }))
);

/**
 * Prudentia — AI-powered offer letter analyser for Indian engineering students.
 * Root application component managing the full analysis lifecycle.
 */
export default function App(): React.ReactElement {
  const {
    phase,
    analysis,
    error,
    fileName,
    originalFile,
    qaHistory,
    extractedPdfText,
    analyzeDocument,
    askQuestion,
    reset,
  } = useDocumentAnalysis();

  const [targetPage, setTargetPage] = useState<number | undefined>(undefined);
  const [highlightQuote, setHighlightQuote] = useState<string | undefined>(undefined);

  // Stable identity so the memoised clause cards don't all re-render each time
  // "View in document" updates the highlight.
  const handleViewInDocument = useCallback((page: number | undefined, quote: string) => {
    setTargetPage(page);
    setHighlightQuote(quote);
  }, []);

  const isProcessing = phase === 'uploading' || phase === 'analyzing' || phase === 'validating';

  // ── Error state ──────────────────────────────────────────────────────────────
  if (phase === 'error' && error) {
    return (
      <div id="prudentia-error-state" role="alert" aria-live="assertive" className="state-screen">
        <div className="state-card is-error">
          <div className="state-icon-error"><IconAlertTriangle size={32} /></div>
          <h1>Analysis Failed</h1>
          <p className="state-error-message">{error.message}</p>
          {error.validation_errors && error.validation_errors.length > 0 && (
            <details className="state-error-details">
              <summary>Technical details</summary>
              <ul>{error.validation_errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </details>
          )}
          <button
            className={error.is_retryable ? 'btn btn-primary' : 'btn btn-ghost'}
            id={error.is_retryable ? 'retry-upload-btn' : 'reset-after-error-btn'}
            type="button"
            onClick={reset}
          >
            {error.is_retryable ? (<><IconRefresh size={15} /> Try again</>) : 'Start over'}
          </button>
        </div>
      </div>
    );
  }

  // ── Analysis loading state ───────────────────────────────────────────────────
  if (isProcessing) {
    return <AnalyzingState key={fileName} fileName={fileName} />;
  }

  // ── Complete state — Two-pane layout ─────────────────────────────────────────
  if (phase === 'complete' && analysis) {
    return (
      <TwoPaneLayout
        leftPane={
          <AnalysisResultsView
            analysis={analysis}
            fileName={fileName}
            extractedPdfText={extractedPdfText}
            qaHistory={qaHistory}
            onAskQuestion={askQuestion}
            onReset={reset}
            onViewInDocument={handleViewInDocument}
          />
        }
        rightPane={
          originalFile ? (
            <Suspense fallback={<div className="state-spinner-wrap" style={{ paddingTop: '40%' }}><div className="state-spinner" /></div>}>
              <PdfViewer
                file={originalFile}
                targetPage={targetPage}
                highlightQuote={highlightQuote}
              />
            </Suspense>
          ) : null
        }
      />
    );
  }

  // ── Upload / idle state ───────────────────────────────────────────────────────
  return <DocumentUploadScreen onFileSelected={analyzeDocument} />;
}
