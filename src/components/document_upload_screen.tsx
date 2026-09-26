import React, { useRef, useState, useCallback } from 'react';
import { IconFileText, IconAlertTriangle, IconCheck } from './icons.js';

interface DocumentUploadScreenProps {
  onFileSelected: (file: File) => void;
}

const MAX_SIZE_MB = 3;

export function DocumentUploadScreen({ onFileSelected }: DocumentUploadScreenProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const validateAndSubmit = useCallback((file: File) => {
    setFileError(null);
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setFileError('Only PDF files are accepted. Please upload your offer letter as a PDF.');
      return;
    }
    // Vercel's Node serverless functions hard-cap the request body at 4.5 MB,
    // and base64-encoding a PDF inflates its size by ~33% before it's sent.
    // 3 MB of raw file leaves headroom under that ceiling; anything larger
    // would pass this check but fail at Vercel's routing layer in production
    // with a non-JSON error the client can't parse.
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setFileError(`File is too large (maximum ${MAX_SIZE_MB} MB). Try printing it to a smaller PDF.`);
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

  return (
    <div id="prudentia-upload-screen">
      <header>
        <span className="eyebrow">AI for legal assistance &amp; access</span>
        <h1>Prudentia</h1>
        <p>The offer letter analyser that grounds every risk flag in actual Indian law — and shows you what happens if a clause gets triggered.</p>
      </header>
      <main>
        <section aria-labelledby="upload-heading">
          <div
            id="upload-drop-zone"
            role="button" tabIndex={0}
            aria-label={`Click or drag and drop to upload a PDF offer letter, maximum ${MAX_SIZE_MB} megabytes`}
            data-drag-active={dragOver}
            onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          >
            <input ref={fileInputRef} id="pdf-file-input" type="file" accept=".pdf,application/pdf"
              aria-label="Select PDF offer letter" style={{ display: 'none' }} onChange={handleFileChange} />
            <span className="upload-icon"><IconFileText size={34} /></span>
            <p>Drop your PDF here, or click to browse</p>
            <span className="upload-meta">
              PDF only · Not stored · <span className="upload-size-limit">Max {MAX_SIZE_MB} MB</span>
            </span>
          </div>
          {fileError && (
            <p id="upload-error" role="alert" aria-live="assertive">
              <IconAlertTriangle size={16} /> {fileError}
            </p>
          )}
        </section>

        <section aria-labelledby="why-prudentia-heading">
          <h2 id="why-prudentia-heading">Why not just use ChatGPT or Gemini?</h2>
          <p>A generic AI assistant can summarise a pasted contract — but it:</p>
          <ul className="feature-list">
            <li>
              <span className="feature-icon"><IconCheck size={13} /></span>
              <span><strong>Won't cite a real, verifiable statute section.</strong> Prudentia injects actual Indian statute text (Indian Contract Act, Specific Relief Act, etc.) into its analysis — not training-data approximations.</span>
            </li>
            <li>
              <span className="feature-icon"><IconCheck size={13} /></span>
              <span><strong>Gives inconsistent answers on retry</strong> because nothing is grounded to a fixed reference. Prudentia's statute-to-clause mapping is deterministic.</span>
            </li>
            <li>
              <span className="feature-icon"><IconCheck size={13} /></span>
              <span><strong>Is reactive — you have to know what to ask.</strong> Prudentia proactively flags every legally significant clause type (bond, non-compete, notice period, IP assignment) without the user having to know what to look for.</span>
            </li>
            <li>
              <span className="feature-icon"><IconCheck size={13} /></span>
              <span><strong>Cannot tell you what happens if a clause is triggered.</strong> Prudentia generates consequence scenarios with outcome likelihood for each clause.</span>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
