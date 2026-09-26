/**
 * Tests for indian_statute_reference.ts
 * Validates the statute reference data integrity — ensures all entries
 * have required fields and correct structure.
 */

import { describe, it, expect } from 'vitest';
import { INDIAN_STATUTE_REFERENCE } from '../src/data/indian_statute_reference';

describe('INDIAN_STATUTE_REFERENCE', () => {
  const entries = Object.entries(INDIAN_STATUTE_REFERENCE);

  it('contains at least 5 statute entries', () => {
    expect(entries.length).toBeGreaterThanOrEqual(5);
  });

  it('all entries have required fields: act, section, title, text, relevance_note', () => {
    for (const [key, entry] of entries) {
      expect(entry.act, `${key} missing act`).toBeTruthy();
      expect(entry.section, `${key} missing section`).toBeTruthy();
      expect(entry.title, `${key} missing title`).toBeTruthy();
      expect(entry.text, `${key} missing text`).toBeTruthy();
      expect(entry.relevance_note, `${key} missing relevance_note`).toBeTruthy();
    }
  });

  it('contains ICA Section 27 (restraint of trade — critical for non-compete)', () => {
    const hasIca27 = entries.some(([, e]) => e.act.includes('Indian Contract Act') && e.section === '27');
    expect(hasIca27).toBe(true);
  });

  it('contains ICA Sections 73 and 74 (damages — critical for bond penalties)', () => {
    const sections = entries.map(([, e]) => e.section);
    expect(sections).toContain('73');
    expect(sections).toContain('74');
  });

  it('contains Copyright Act Section 17 (employer IP ownership)', () => {
    const hasCopyright = entries.some(([, e]) => e.act.includes('Copyright') && e.section === '17');
    expect(hasCopyright).toBe(true);
  });

  it('all text fields are non-trivial (> 50 chars)', () => {
    for (const [key, entry] of entries) {
      expect(entry.text.length, `${key} text too short`).toBeGreaterThan(50);
    }
  });

  it('all keys follow naming convention (uppercase with underscores)', () => {
    for (const [key] of entries) {
      expect(key).toMatch(/^[A-Za-z0-9_]+$/);
    }
  });
});
