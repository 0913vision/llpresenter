import {describe, expect, it} from 'vitest';
import {
  buildContext,
  NOTES_PATH,
  roleFor,
  truncate,
  type SessionFacts,
} from './session-context';

const baseFacts: SessionFacts = {
  source: 'startup',
  branch: 'rewrite/trial',
  notes: '# Notes\n\n## Now\n\nWriting the store test.',
  notesUpdated: '2026-10-24T09:00:00.000Z',
  status: '# Status\n\nPhase 1.',
  git: 'Working tree clean.',
};

describe('roleFor', () => {
  it('names the lead, members, and anything else', () => {
    expect(roleFor('rewrite')).toBe('lead');
    expect(roleFor('rewrite/trial')).toBe('trial');
    expect(roleFor('rewrite/')).toBe('unknown');
    expect(roleFor('main')).toBe('unknown');
    expect(roleFor('')).toBe('unknown');
  });
});

describe('truncate', () => {
  it('keeps short text and marks what it cut', () => {
    expect(truncate('abc', 3)).toBe('abc');
    expect(truncate('abcdef', 4)).toBe(
      'abcd\n[... 2 more characters in the file]',
    );
  });
});

describe('buildContext', () => {
  it('names the session and includes its notes, git state, and status', () => {
    const text = buildContext(baseFacts);
    expect(text).toContain('You are the trial session on branch rewrite/trial');
    expect(text).toContain('Writing the store test.');
    expect(text).toContain('updated 2026-10-24T09:00:00.000Z');
    expect(text).toContain('Working tree clean.');
    expect(text).toContain('Phase 1.');
  });

  it('tells a compacted session to re-read before it continues', () => {
    expect(buildContext({...baseFacts, source: 'compact'})).toContain(
      'Your context was just compacted',
    );
    expect(buildContext(baseFacts)).not.toContain('compacted');
  });

  it('asks for a notes file when there is none', () => {
    const text = buildContext({...baseFacts, notes: null, notesUpdated: null});
    expect(text).toContain(`There is no notes file yet. Create ${NOTES_PATH}`);
  });

  it('leaves out the status section when the file is missing', () => {
    expect(buildContext({...baseFacts, status: null})).not.toContain(
      'Team status',
    );
  });

  it('keeps long notes and status within their limits', () => {
    const notes = 'x'.repeat(20_000);
    const status = Array.from({length: 200}, (_, i) => `line ${i}`).join('\n');
    const text = buildContext({...baseFacts, notes, status});
    expect(text).toContain('[... 8000 more characters in the file]');
    expect(text).toContain('[... 120 more lines in the file]');
    expect(text.length).toBeLessThan(15_000);
  });
});
