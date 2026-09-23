/**
 * App.tsx
 *
 * Root application component. Manages top-level routing between:
 *   - Upload screen (idle state)
 *   - Processing state (uploading/analyzing/validating)
 *   - Results view (complete state)
 *   - Error state
 *
 * All state flows through useDocumentAnalysis — this component is thin.
 */

import React from 'react';
import { useDocumentAnalysis } from './hooks/use_document_analysis';
import { DocumentUploadScreen } from './components/document_upload_screen';
import { AnalysisResultsView } from './components/analysis_results_view';

export default function App(): React.ReactElement {
  const {
    phase,
    analysis,
    error,
    fileName,
    qaHistory,
    analyzeDocument,
    askQuestion,
    reset,
  } = useDocumentAnalysis();

  // Processing states: uploading, analyzing, validating
  const isProcessing =
    phase === 'uploading' || phase === 'analyzing' || phase === 'validating';

  // Error state
  if (phase === 'error' && error) {
    return (
      <div id="prudentia-error-state" role="alert" aria-live="assertive">
        <h1>Prudentia</h1>
        <h2>Analysis failed</h2>
        <p>{error.message}</p>
        {error.validation_errors && error.validation_errors.length > 0 && (
          <details>
            <summary>Technical details</summary>
            <ul>
              {error.validation_errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </details>
        )}
        {error.is_retryable && (
          <button
            id="retry-upload-btn"
            type="button"
            onClick={reset}
            aria-label="Go back and try uploading again"
          >
            Try again
          </button>
        )}
        {!error.is_retryable && (
          <button
            id="reset-after-error-btn"
            type="button"
            onClick={reset}
            aria-label="Start over with a different document"
          >
            Start over
          </button>
        )}
      </div>
    );
  }

  // Results view
  if (phase === 'complete' && analysis) {
    return (
      <AnalysisResultsView
        analysis={analysis}
        fileName={fileName}
        qaHistory={qaHistory}
        onAskQuestion={askQuestion}
        onReset={reset}
      />
    );
  }

  // Upload screen (idle) + processing state
  return (
    <DocumentUploadScreen
      onFileSelected={analyzeDocument}
      isProcessing={isProcessing}
    />
  );
}
