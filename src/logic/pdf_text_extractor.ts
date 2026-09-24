/**
 * pdf_text_extractor.ts
 *
 * Client-side PDF text extraction using PDF.js.
 *
 * ARCHITECTURAL SIGNIFICANCE:
 * This module independently extracts text from the uploaded PDF — completely
 * separate from Gemini's analysis. This means quote verification is no longer
 * self-referential (i.e., checking Gemini's quotes against Gemini's quotes).
 * Instead, we check Gemini's exact_quote claims against independently parsed
 * PDF text, making hallucination detection structurally reliable.
 *
 * This is the same architectural approach used by Contextualis (TOP 1) —
 * the strongest competitor — but applied here without their 515-line matcher
 * complexity. Our verifier already handles fuzzy matching; this module simply
 * provides the independent text corpus it needs.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure the PDF.js worker from CDN (avoids bundler complexity)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs`;

/**
 * Result of extracting text from a PDF.
 */
export interface PdfExtractionResult {
  /** Full text of the PDF, concatenated from all pages */
  fullText: string;
  /** Text content per page (0-indexed) */
  pages: PdfPageText[];
  /** Total page count */
  pageCount: number;
}

export interface PdfPageText {
  /** 0-indexed page number */
  pageIndex: number;
  /** All text items on this page */
  text: string;
}

/**
 * Extract all text from a PDF file using PDF.js.
 *
 * This runs entirely client-side — no server round-trip.
 * The extracted text is used as the verification corpus for
 * document_quote_verifier.ts, replacing the self-referential
 * approach of verifying quotes against themselves.
 *
 * @param file - The uploaded PDF File object
 * @returns Extracted text organized by page
 */
export async function extractTextFromPdf(file: File): Promise<PdfExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pages: PdfPageText[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Concatenate all text items on this page, preserving whitespace structure
    const pageText = textContent.items
      .filter((item: any): item is { str: string; hasEOL?: boolean } => 'str' in item)
      .map((item: any) => {
        return item.str + (item.hasEOL ? '\n' : '');
      })
      .join('');

    pages.push({
      pageIndex: i - 1,
      text: pageText.trim(),
    });
  }

  const fullText = pages.map((p) => p.text).join('\n\n');

  return {
    fullText,
    pages,
    pageCount: pdf.numPages,
  };
}
