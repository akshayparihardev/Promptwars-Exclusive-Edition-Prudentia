/**
 * clause_to_statute_matcher.test.ts
 *
 * Tests for the deterministic clause-type → statute mapping.
 */

import { describe, it, expect } from 'vitest';
import {
  CLAUSE_TYPE_TO_STATUTE,
  getStatuteKeysForClauseType,
  getStatuteEntriesForClauseType,
  buildStatuteContextForPrompt,
  getClauseTypeLabel,
  type ClauseType,
} from '../src/logic/clause_to_statute_matcher';

describe('CLAUSE_TYPE_TO_STATUTE mapping', () => {
  it('maps bond to the correct statute keys', () => {
    expect(CLAUSE_TYPE_TO_STATUTE.bond).toEqual(['ICA_SEC_27', 'ICA_SEC_73', 'ICA_SEC_74']);
  });

  it('maps non_compete to the correct statute keys', () => {
    expect(CLAUSE_TYPE_TO_STATUTE.non_compete).toEqual(['ICA_SEC_27', 'SRA_SEC_41']);
  });

  it('maps notice_period to the correct statute keys', () => {
    expect(CLAUSE_TYPE_TO_STATUTE.notice_period).toEqual(['ICA_SEC_73', 'IE_SEC_3']);
  });

  it('maps probation to the correct statute keys', () => {
    expect(CLAUSE_TYPE_TO_STATUTE.probation).toEqual(['ICA_SEC_23', 'IE_SEC_3']);
  });

  it('maps ip_assignment to the correct statute keys', () => {
    expect(CLAUSE_TYPE_TO_STATUTE.ip_assignment).toEqual(['CA_SEC_17', 'PA_SEC_6']);
  });

  it('maps general to an empty array', () => {
    expect(CLAUSE_TYPE_TO_STATUTE.general).toEqual([]);
  });

  it('covers all six clause types', () => {
    const allTypes: ClauseType[] = ['bond', 'non_compete', 'notice_period', 'probation', 'ip_assignment', 'general'];
    for (const t of allTypes) {
      expect(CLAUSE_TYPE_TO_STATUTE).toHaveProperty(t);
    }
  });
});

describe('getStatuteKeysForClauseType', () => {
  it('returns an array for every clause type', () => {
    const types: ClauseType[] = ['bond', 'non_compete', 'notice_period', 'probation', 'ip_assignment', 'general'];
    for (const t of types) {
      expect(Array.isArray(getStatuteKeysForClauseType(t))).toBe(true);
    }
  });

  it('returns empty array for general', () => {
    expect(getStatuteKeysForClauseType('general')).toHaveLength(0);
  });

  it('returns 3 keys for bond', () => {
    expect(getStatuteKeysForClauseType('bond')).toHaveLength(3);
  });
});

describe('getStatuteEntriesForClauseType', () => {
  it('returns entries with act and section strings for bond', () => {
    const entries = getStatuteEntriesForClauseType('bond');
    expect(entries.length).toBe(3);
    for (const e of entries) {
      expect(typeof e.act).toBe('string');
      expect(typeof e.section).toBe('string');
    }
  });

  it('returns empty array for general', () => {
    expect(getStatuteEntriesForClauseType('general')).toHaveLength(0);
  });

  it('includes ICA 1872 entries for bond', () => {
    const entries = getStatuteEntriesForClauseType('bond');
    const acts = entries.map((e) => e.act);
    expect(acts.every((a) => a.includes('Indian Contract Act'))).toBe(true);
  });
});

describe('buildStatuteContextForPrompt', () => {
  it('returns a non-empty string for bond clause', () => {
    const context = buildStatuteContextForPrompt('bond');
    expect(context.length).toBeGreaterThan(0);
    expect(context).toContain('Indian Contract Act');
  });

  it('returns empty string for general clause', () => {
    const context = buildStatuteContextForPrompt('general');
    expect(context).toBe('');
  });

  it('contains numbered list items for multi-statute types', () => {
    const context = buildStatuteContextForPrompt('bond');
    expect(context).toContain('1.');
    expect(context).toContain('2.');
    expect(context).toContain('3.');
  });

  it('includes ICA Section 27 for non_compete — critical for post-employment restraint detection', () => {
    const context = buildStatuteContextForPrompt('non_compete');
    expect(context).toContain('27');
    // Must include the employment distinction note
    expect(context.toLowerCase()).toContain('employment');
  });
});

describe('getClauseTypeLabel', () => {
  it('returns human-readable labels for all clause types', () => {
    const types: ClauseType[] = ['bond', 'non_compete', 'notice_period', 'probation', 'ip_assignment', 'general'];
    for (const t of types) {
      const label = getClauseTypeLabel(t);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('returns "Service Bond" for bond type', () => {
    expect(getClauseTypeLabel('bond')).toBe('Service Bond');
  });

  it('returns "General Clause" for general type', () => {
    expect(getClauseTypeLabel('general')).toBe('General Clause');
  });
});
