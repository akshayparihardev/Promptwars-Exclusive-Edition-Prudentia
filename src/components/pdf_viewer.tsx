import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import './pdf_viewer.css';

interface PdfViewerProps {
  file: File;
  targetPage?: number;
  highlightQuote?: string;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Normalize text for comparison: lowercase, collapse whitespace, remove punctuation variants.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[\u2018\u2019\u201c\u201d]/g, "'").replace(/\s+/g, ' ').trim();
}

/**
 * Find the best multi-span match of searchText within the page's text items.
 * Returns an array of rects (one per matching text item span) in PDF unscaled coordinates.
 * 
 * Strategy:
 * 1. Build a token array from all text items with position metadata
 * 2. Concatenate tokens into a single string for substring search
 * 3. When a match is found, map back to the source items using char offsets
 * 4. Return bounding rects for each matched item
 */
function findHighlightRects(items: TextItem[], searchText: string, scale: number, viewportHeight: number): HighlightRect[] {
  if (!searchText || items.length === 0) return [];

  // Build a flat text and a map from char index → item index
  let flat = '';
  const tokenPositionMap: { itemIdx: number; charIdx: number }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.str) continue;
        flat += item.str;
    for (let c = 0; c < item.str.length; c++) {
      tokenPositionMap.push({ itemIdx: i, charIdx: c });
    }
    // Add a space between items if needed for word boundary matching
    if (!item.str.endsWith(' ') && i < items.length - 1) {
      flat += ' ';
      tokenPositionMap.push({ itemIdx: i, charIdx: item.str.length - 1 });
    }
  }

  const normalizedFlat = normalize(flat);
  const normalizedSearch = normalize(searchText);
  
  // Try to find the search text — try progressively shorter prefixes if not found
  // (handles cases where the quote is truncated in the rendered page)
  let matchStart = -1;
  let matchEnd = -1;
  let searchLen = normalizedSearch.length;
  
  while (searchLen >= Math.min(40, normalizedSearch.length * 0.5)) {
    const sub = normalizedSearch.slice(0, searchLen);
    const idx = normalizedFlat.indexOf(sub);
    if (idx !== -1) {
      matchStart = idx;
      matchEnd = idx + sub.length;
      break;
    }
    searchLen = Math.floor(searchLen * 0.85);
  }

  if (matchStart === -1) return [];

  // Find which items are covered by [matchStart, matchEnd]
  const coveredItems = new Set<number>();
  for (let c = matchStart; c < matchEnd && c < tokenPositionMap.length; c++) {
    coveredItems.add(tokenPositionMap[c].itemIdx);
  }

  // Group into contiguous runs (same item) and compute rects
  const rects: HighlightRect[] = [];
  for (const idx of coveredItems) {
    const item = items[idx];
    if (!item.str.trim()) continue;

    // PDF coordinate system: origin bottom-left, y increases up
    // transform = [scaleX, skewY, skewX, scaleY, tx, ty]
    const tx = item.transform[4];
    const ty = item.transform[5];
    const fontHeight = Math.abs(item.transform[3]);
    
    // Convert from PDF space to canvas space (y-flip)
    const canvasTop = (viewportHeight - ty - fontHeight) * scale;
    const canvasLeft = tx * scale;
    const canvasWidth = item.width * scale;
    const canvasHeight = (fontHeight + 2) * scale; // +2 for visual padding

    rects.push({
      left: canvasLeft,
      top: canvasTop,
      width: Math.max(canvasWidth, 4),
      height: Math.max(canvasHeight, 8),
    });
  }

  return rects;
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
  const [highlightCount, setHighlightCount] = useState(0);

  const scaleRef = useRef<number>(1);
  const unscaledHeightRef = useRef<number>(0);
  const renderTaskRef = useRef<any>(null);

  // Load PDF. `loading`/`error` start at their correct values (true/null) via
  // useState above and don't need resetting here: PdfViewer only ever mounts
  // fresh per file (App.tsx's phase-based rendering fully unmounts it between
  // uploads), so a synchronous setState at the top of this effect was dead code.
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
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

  const drawHighlights = useCallback(async (page: pdfjsLib.PDFPageProxy) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.innerHTML = '';
    setHighlightCount(0);

    if (!highlightQuote) return;

    try {
      const textContent = await page.getTextContent();
      const items = textContent.items as TextItem[];
      const rects = findHighlightRects(
        items,
        highlightQuote,
        scaleRef.current,
        unscaledHeightRef.current
      );

      setHighlightCount(rects.length);

      for (const rect of rects) {
        const div = document.createElement('div');
        div.className = 'pdf-highlight';
        div.style.left = `${rect.left}px`;
        div.style.top = `${rect.top}px`;
        div.style.width = `${rect.width}px`;
        div.style.height = `${rect.height}px`;
        overlay.appendChild(div);
      }
    } catch (e) {
      console.error('Highlight error:', e);
    }
  }, [highlightQuote]);

  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      const page = await pdfDoc.getPage(currentPage);
      const containerWidth = containerRef.current.clientWidth - 32;
      const unscaled = page.getViewport({ scale: 1 });
      const scale = Math.min(containerWidth / unscaled.width, 2.0);
      const viewport = page.getViewport({ scale });

      scaleRef.current = scale;
      unscaledHeightRef.current = unscaled.height;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';

      renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
      await renderTaskRef.current.promise;
      renderTaskRef.current = null;

      await drawHighlights(page);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Render error:', err);
      }
    }
  }, [pdfDoc, currentPage, drawHighlights]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Re-render on resize, but debounced and only when the width actually changed:
  // a full canvas re-render per ResizeObserver callback is wasteful while the
  // window is being dragged, and the observer's initial callback is redundant
  // with the render effect above.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let lastWidth = container.clientWidth;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      clearTimeout(timer);
      timer = setTimeout(() => { renderPage(); }, 150);
    });
    observer.observe(container);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [renderPage]);

  return (
    <div className="pdf-viewer-container" ref={containerRef}>
      {error && <div className="pdf-error">{error}</div>}

      <div className="pdf-controls">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage <= 1 || loading}
          className="btn-secondary"
        >
          ← Prev
        </button>
        <span className="pdf-page-info">
          {loading ? 'Loading...' : `Page ${currentPage} of ${numPages}`}
        </span>
        <button
          onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages || loading}
          className="btn-secondary"
        >
          Next →
        </button>
      </div>

      {highlightQuote && !loading && (
        <div className="pdf-highlight-status">
          {highlightCount > 0
            ? `✓ ${highlightCount} span${highlightCount !== 1 ? 's' : ''} highlighted`
            : '⚠ Quote spans multiple pages or is not on this page'}
        </div>
      )}

      {!highlightQuote && !loading && (
        <div className="pdf-hint">
          Click "View in document" on any clause to highlight it here
        </div>
      )}

      <div className="pdf-canvas-wrapper">
        <canvas ref={canvasRef} className="pdf-canvas" />
        <div ref={overlayRef} className="pdf-highlight-overlay" />
      </div>
    </div>
  );
}
