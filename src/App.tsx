import React from 'react';
import { useDocumentAnalysis } from './hooks/use_document_analysis';
import { DocumentUploadScreen } from './components/document_upload_screen';
import { AnalysisResultsView } from './components/analysis_results_view';

export default function App(): React.ReactElement {
  const { phase, analysis, error, fileName, qaHistory, extractedPdfText, analyzeDocument, askQuestion, reset } = useDocumentAnalysis();
  const isProcessing = phase === 'uploading' || phase === 'analyzing' || phase === 'validating';

  if (phase === 'error' && error) {
    return (
      <div id="prudentia-error-state" role="alert" aria-live="assertive">
        <h1>Prudentia</h1>
        <h2>Analysis failed</h2>
        <p>{error.message}</p>
        {error.validation_errors && error.validation_errors.length > 0 && (
          <details>
            <summary>Technical details</summary>
            <ul>{error.validation_errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </details>
        )}
        <button className={`btn ${error.is_retryable ? 'btn-primary' : 'btn-ghost'}`}
          id={error.is_retryable ? 'retry-upload-btn' : 'reset-after-error-btn'}
          type="button" onClick={reset}>
          {error.is_retryable ? 'Try again' : 'Start over'}
        </button>
      </div>
    );
  }

  if (phase === 'complete' && analysis) {
    return (
      <AnalysisResultsView
        analysis={analysis} fileName={fileName} extractedPdfText={extractedPdfText}
        qaHistory={qaHistory} onAskQuestion={askQuestion} onReset={reset}
      />
    );
  }

  return <DocumentUploadScreen onFileSelected={analyzeDocument} isProcessing={isProcessing} />;
}
