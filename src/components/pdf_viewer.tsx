import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import './pdf_viewer.css';

interface PdfViewerProps {
  file: File;
  targetPage?: number;
  highlightQuote?: string;
}

export function PdfViewer({ file, targetPage, highlightQuote }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const viewportRef = useRef<any>(null);
  const unscaledViewportRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  // Load PDF
  useEffect(() => {
    let active = true;
    setLoading(true);
    
    const load = async () => {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.162/pdf.worker.min.mjs';
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (active) {
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setCurrentPage(1);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Error loading PDF');
          setLoading(false);
        }
      }
    };
    load();
    return () => { active = false; };
  }, [file]);

  // Navigate to target page
  useEffect(() => {
    if (targetPage && targetPage > 0 && targetPage <= numPages) {
      setCurrentPage(targetPage);
    }
  }, [targetPage, numPages]);

  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDoc.getPage(currentPage);
      const containerWidth = containerRef.current.clientWidth - 32;
      const unscaled = page.getViewport({ scale: 1 });
      const scale = Math.min(containerWidth / unscaled.width, 2.0);
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';

      viewportRef.current = viewport;
      unscaledViewportRef.current = unscaled;

      renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
      await renderTaskRef.current.promise;
      renderTaskRef.current = null;
      
      // Draw highlights after rendering
      drawHighlights(page, scale);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Render error:', err);
      }
    }
  }, [pdfDoc, currentPage, highlightQuote]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Handle resizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      renderPage();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [renderPage]);

  const drawHighlights = async (page: pdfjsLib.PDFPageProxy, scale: number) => {
    const overlay = overlayRef.current;
    if (!overlay || !highlightQuote) {
       if (overlay) overlay.innerHTML = '';
       return;
    }
    overlay.innerHTML = '';

    try {
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];
      
      // Very basic text matching for highlighting
      const normalizedSearch = highlightQuote.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!normalizedSearch) return;

      // This is a simplified highlighting approach. We highlight any text item
      // that contains part of the search string or vice-versa.
      // A more robust approach requires matching across items, but this works well for MVP.
      for (const item of items) {
        if (!item.str || item.str.trim() === '') continue;
        const normalizedItem = item.str.toLowerCase().replace(/\s+/g, ' ').trim();
        
        if (normalizedItem.length > 5 && (normalizedSearch.includes(normalizedItem) || normalizedItem.includes(normalizedSearch))) {
          // Transform coordinates from PDF space to canvas space
          // transform is [scaleX, skewY, skewX, scaleY, tx, ty]
          const tx = item.transform[4];
          const ty = item.transform[5];
          const fontHeight = item.transform[3];
          
          // pdf.js uses bottom-left origin for y.
          const pdfY = unscaledViewportRef.current.height - ty;
          
          const div = document.createElement('div');
          div.className = 'pdf-highlight';
          div.style.left = `${(tx * scale)}px`;
          div.style.top = `${(pdfY - fontHeight) * scale}px`;
          div.style.width = `${item.width * scale}px`;
          div.style.height = `${fontHeight * scale}px`;
          overlay.appendChild(div);
        }
      }
    } catch (e) {
      console.error('Highlight error:', e);
    }
  };

  return (
    <div className="pdf-viewer-container" ref={containerRef}>
      {loading && <div className="pdf-loading">Loading PDF...</div>}
      {error && <div className="pdf-error">{error}</div>}
      
      <div className="pdf-controls">
        <button 
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage <= 1 || loading}
          className="btn-secondary"
        >
          Previous
        </button>
        <span className="pdf-page-info">
          Page {currentPage} of {numPages || '?'}
        </span>
        <button 
          onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages || loading}
          className="btn-secondary"
        >
          Next
        </button>
      </div>

      <div className="pdf-canvas-wrapper">
        <canvas ref={canvasRef} className="pdf-canvas" />
        <div ref={overlayRef} className="pdf-highlight-overlay" />
      </div>
    </div>
  );
}
