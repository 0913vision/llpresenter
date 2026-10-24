import {describe, expect, it} from 'vitest';
import {
  bumpSubject,
  classifySubject,
  COMMIT_TAGS,
  parseSubject,
} from './subject.mts';

describe('parseSubject', () => {
  it('splits a subject into its tag, scope, and sentence', () => {
    expect(parseSubject('feat(live): add undo for the last clear')).toEqual({
      tag: 'feat',
      scope: 'live',
      sentence: 'add undo for the last clear',
    });
  });

  it('knows the tags of CLAUDE.md, in its order', () => {
    expect(COMMIT_TAGS).toEqual([
      'break',
      'feat',
      'fix',
      'refactor',
      'style',
      'docs',
      'test',
      'chore',
    ]);
  });

  it('accepts a tests-only commit', () => {
    expect(parseSubject('test(show): cover an empty service')?.tag).toBe(
      'test',
    );
  });

  it.each(COMMIT_TAGS)('accepts the %s tag', tag => {
    expect(parseSubject(`${tag}(repo): change something`)?.tag).toBe(tag);
  });

  it('accepts a kebab-case scope', () => {
    expect(parseSubject('fix(output-window): keep the last frame')?.scope).toBe(
      'output-window',
    );
  });

  it.each([
    ['an unknown tag', 'feature(live): add undo'],
    ['no scope', 'feat: add undo'],
    ['an empty scope', 'feat(): add undo'],
    ['an uppercase scope', 'feat(Live): add undo'],
    ['no space after the colon', 'feat(live):add undo'],
    ['a capitalized sentence', 'feat(live): Add undo'],
    ['a trailing period', 'feat(live): add undo.'],
    ['an empty sentence', 'feat(live): '],
    ['a merge commit', "Merge branch 'feat/ui/form-controls'"],
  ])('rejects %s', (_label, subject) => {
    expect(parseSubject(subject)).toBeNull();
  });
});

describe('classifySubject', () => {
  it('knows the bot bump commit', () => {
    expect(classifySubject(bumpSubject('0.3.0'))).toEqual({kind: 'bump'});
  });

  it('passes a tagged subject through with its parts', () => {
    expect(classifySubject('fix(ui): keep the focus ring')).toEqual({
      kind: 'tagged',
      subject: {tag: 'fix', scope: 'ui', sentence: 'keep the focus ring'},
    });
  });

  it.each([
    'Bump version: 0.3',
    'Bump version: v0.3.0',
    'bump version: 0.3.0',
    'Bump version 0.3.0',
    'Bump version: 0.3.0 for the release',
  ])('rejects the near miss %j', subject => {
    expect(classifySubject(subject)).toEqual({kind: 'invalid'});
  });

  it('treats a member commit about versions as an ordinary commit', () => {
    expect(
      classifySubject('chore(version): bump the version to 0.3.0').kind,
    ).toBe('tagged');
  });
});
