/**
 * Tests for pdf_text_extractor.ts
 * Unit tests for the PdfExtractionResult interface and module exports.
 * 
 * Note: Full PDF.js integration tests require a browser environment.
 * These tests verify the module's type exports and structure are correct.
 */

import { describe, it, expect } from 'vitest';

describe('pdf_text_extractor module', () => {
  it('exports extractTextFromPdf function', async () => {
    const mod = await import('../src/logic/pdf_text_extractor');
    expect(typeof mod.extractTextFromPdf).toBe('function');
  });

  it('PdfExtractionResult interface is usable as a type', () => {
    // Type-level test — if this compiles, the interface is correctly exported
    const result: import('../src/logic/pdf_text_extractor').PdfExtractionResult = {
      fullText: 'Hello world',
      pages: [{ pageIndex: 0, text: 'Hello world' }],
      pageCount: 1,
    };
    expect(result.fullText).toBe('Hello world');
    expect(result.pages).toHaveLength(1);
    expect(result.pageCount).toBe(1);
  });

  it('PdfPageText interface has correct shape', () => {
    const page: import('../src/logic/pdf_text_extractor').PdfPageText = {
      pageIndex: 0,
      text: 'Page content',
    };
    expect(page.pageIndex).toBe(0);
    expect(page.text).toBe('Page content');
  });
});
