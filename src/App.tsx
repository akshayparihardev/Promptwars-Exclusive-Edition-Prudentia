import React from 'react';
import { useState } from 'react';
import { useDocumentAnalysis } from './hooks/use_document_analysis';
import { DocumentUploadScreen } from './components/document_upload_screen';
import { AnalysisResultsView } from './components/analysis_results_view';
import { TwoPaneLayout } from './components/two_pane_layout';
import { PdfViewer } from './components/pdf_viewer';

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
    analysisStatus,
    analyzeDocument,
    askQuestion,
    reset,
  } = useDocumentAnalysis();

  const [targetPage, setTargetPage] = useState<number | undefined>(undefined);
  const [highlightQuote, setHighlightQuote] = useState<string | undefined>(undefined);

  const isProcessing = phase === 'uploading' || phase === 'analyzing' || phase === 'validating';

  // ── Error state ──────────────────────────────────────────────────────────────
  if (phase === 'error' && error) {
    return (
      <div id="prudentia-error-state" role="alert" aria-live="assertive" className="error-screen">
        <div className="error-card">
          <div className="error-icon">⚠️</div>
          <h1>Analysis Failed</h1>
          <p className="error-message">{error.message}</p>
          {error.validation_errors && error.validation_errors.length > 0 && (
            <details className="error-details">
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
            {error.is_retryable ? '🔄 Try again' : 'Start over'}
          </button>
        </div>
      </div>
    );
  }

  // ── Analysis loading state ───────────────────────────────────────────────────
  if (isProcessing) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-card">
          <div className="loading-logo">⚖ Prudentia</div>
          <div className="loading-spinner-wrapper">
            <div className="loading-spinner" />
          </div>
          <h2 className="loading-headline">Analysing your offer letter</h2>
          <p className="loading-file">{fileName}</p>
          <div className="loading-status-message" aria-live="polite">
            {analysisStatus || '🔄 Starting analysis...'}
          </div>
          <div className="loading-steps">
            <div className="loading-step">🏛 Injecting real Indian statute text (ICA 1872, SRA 1963)</div>
            <div className="loading-step">🔍 Identifying and classifying clauses</div>
            <div className="loading-step">📋 Modelling consequence scenarios per clause</div>
            <div className="loading-step">✅ Verifying extracted quotes against source PDF</div>
          </div>
          <p className="loading-footnote">This typically takes 15–25 seconds. We're being thorough.</p>
        </div>
      </div>
    );
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
            onViewInDocument={(page: number | undefined, quote: string) => {
              setTargetPage(page);
              setHighlightQuote(quote);
            }}
          />
        }
        rightPane={
          originalFile ? (
            <PdfViewer
              file={originalFile}
              targetPage={targetPage}
              highlightQuote={highlightQuote}
            />
          ) : null
        }
      />
    );
  }

  // ── Upload / idle state ───────────────────────────────────────────────────────
  return <DocumentUploadScreen onFileSelected={analyzeDocument} isProcessing={isProcessing} />;
}
