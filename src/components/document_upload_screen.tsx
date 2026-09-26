import React, { useRef, useState, useCallback } from 'react';

interface DocumentUploadScreenProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
}

export function DocumentUploadScreen({ onFileSelected, isProcessing }: DocumentUploadScreenProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const validateAndSubmit = useCallback((file: File) => {
    setFileError(null);
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setFileError('Only PDF files are accepted. Please upload your offer letter as a PDF.');
      return;
    }
    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setFileError('File is too large (maximum 10 MB). Try printing it to a smaller PDF.');
      return;
    }
    onFileSelected(file);
  }, [onFileSelected]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSubmit(file);
  }, [validateAndSubmit]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSubmit(file);
  }, [validateAndSubmit]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => { setDragOver(false); }, []);

  if (isProcessing) {
    return (
      <div id="prudentia-processing-state" role="status" aria-live="polite">
        <h1>Prudentia</h1>
        <p>Analysing your offer letter...</p>
        <div aria-label="Loading indicator"><span>●</span><span>●</span><span>●</span></div>
        <p>Gemini is reading the document and grounding each clause in Indian statute text. This typically takes 15–30 seconds.</p>
      </div>
    );
  }

  return (
    <div id="prudentia-upload-screen">
      <header>
        <h1>Prudentia</h1>
        <p>The offer letter analyser that grounds every risk flag in actual Indian law — and shows you what happens if a clause gets triggered.</p>
      </header>
      <main>
        <section aria-labelledby="upload-heading">
          <div
            id="upload-drop-zone"
            role="button" tabIndex={0}
            aria-label="Click or drag and drop to upload a PDF offer letter"
            data-drag-active={dragOver}
            onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          >
            <input ref={fileInputRef} id="pdf-file-input" type="file" accept=".pdf,application/pdf"
              aria-label="Select PDF offer letter" style={{ display: 'none' }} onChange={handleFileChange} />
            <span className="upload-icon" aria-hidden="true">📄</span>
            <p>Drop your PDF here, or click to browse</p>
            <p>PDF only · Max 10 MB · Not stored</p>
          </div>
          {fileError && <p id="upload-error" role="alert" aria-live="assertive">{fileError}</p>}
        </section>

        <section aria-labelledby="why-prudentia-heading">
          <h2 id="why-prudentia-heading">Why not just use ChatGPT or Gemini?</h2>
          <p>A generic AI assistant can summarise a pasted contract — but it:</p>
          <ul>
            <li><strong>Won't cite a real, verifiable statute section.</strong> Prudentia injects actual Indian statute text (Indian Contract Act, Specific Relief Act, etc.) into its analysis — not training-data approximations.</li>
            <li><strong>Gives inconsistent answers on retry</strong> because nothing is grounded to a fixed reference. Prudentia's statute-to-clause mapping is deterministic.</li>
            <li><strong>Is reactive — you have to know what to ask.</strong> Prudentia proactively flags every legally significant clause type (bond, non-compete, notice period, IP assignment) without the user having to know what to look for.</li>
            <li><strong>Cannot tell you what happens if a clause is triggered.</strong> Prudentia generates consequence scenarios with outcome likelihood for each clause.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
