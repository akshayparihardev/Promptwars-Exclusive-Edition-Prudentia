import { describe, it, expect } from 'vitest';
import { formatClauseReference, formatSourceLocation } from '../src/logic/clause_reference_formatter';

describe('formatClauseReference', () => {
  it('prefixes a bare number or numbering scheme with "Clause"', () => {
    expect(formatClauseReference('8.2')).toBe('Clause 8.2');
    expect(formatClauseReference('3(a)')).toBe('Clause 3(a)');
    expect(formatClauseReference(4)).toBe('Clause 4');
  });

  it('keeps an explicitly named reference as printed, capitalised', () => {
    expect(formatClauseReference('Section 3')).toBe('Section 3');
    expect(formatClauseReference('clause 4')).toBe('Clause 4');
    expect(formatClauseReference('para 5')).toBe('Para 5');
  });

  it('keeps only the identifier when the heading text is included', () => {
    expect(formatClauseReference('1. PROBATION PERIOD')).toBe('Clause 1');
    expect(formatClauseReference('Clause 4 – Notice Period')).toBe('Clause 4');
    expect(formatClauseReference('II. Non-Compete')).toBe('Clause II');
  });

  it('returns null for heading text with no clause number', () => {
    expect(formatClauseReference('PROBATION PERIOD')).toBeNull();
  });

  it('returns null when the document does not number its clauses', () => {
    expect(formatClauseReference(null)).toBeNull();
    expect(formatClauseReference(undefined)).toBeNull();
    expect(formatClauseReference('')).toBeNull();
    expect(formatClauseReference('   ')).toBeNull();
  });

  it('ignores values that are not a string or finite number', () => {
    expect(formatClauseReference({ clause: 1 })).toBeNull();
    expect(formatClauseReference(Number.NaN)).toBeNull();
  });
});

describe('formatSourceLocation', () => {
  it('combines clause and page as "Clause 8.2 · Page 14"', () => {
    expect(formatSourceLocation('8.2', 14)).toBe('Clause 8.2 · Page 14');
  });

  it('falls back to whichever part is known', () => {
    expect(formatSourceLocation('8.2', null)).toBe('Clause 8.2');
    expect(formatSourceLocation(null, 14)).toBe('Page 14');
  });

  it('returns null when neither clause nor a valid page is known', () => {
    expect(formatSourceLocation(null, null)).toBeNull();
    expect(formatSourceLocation(undefined, 0)).toBeNull();
  });
});
