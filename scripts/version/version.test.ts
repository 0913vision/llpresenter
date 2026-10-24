import {describe, expect, it} from 'vitest';
import {classifySubject, type SubjectKind} from './subject.mts';
import {
  bumpVersion,
  formatVersion,
  parseVersion,
  pickBump,
} from './version.mts';

function kinds(...subjects: string[]): SubjectKind[] {
  return subjects.map(classifySubject);
}

describe('parseVersion and formatVersion', () => {
  it('reads and writes x.y.z', () => {
    const version = parseVersion('0.12.3');
    expect(version).toEqual({major: 0, minor: 12, patch: 3});
    expect(version && formatVersion(version)).toBe('0.12.3');
  });

  it.each(['1.2', '1.2.3.4', 'v1.2.3', '01.2.3', '1.2.3-beta', ''])(
    'rejects %j',
    text => {
      expect(parseVersion(text)).toBeNull();
    },
  );
});

describe('pickBump', () => {
  it.each(['break', 'feat', 'refactor'])('raises the minor for %s', tag => {
    expect(pickBump(kinds(`${tag}(live): change it`), false)).toBe('minor');
  });

  it.each(['fix', 'style', 'chore', 'docs', 'test'])(
    'raises the patch for %s',
    tag => {
      expect(pickBump(kinds(`${tag}(live): change it`), false)).toBe('patch');
    },
  );

  it('raises the minor when any commit is a minor type', () => {
    const pushed = kinds(
      'fix(live): keep the frame',
      'feat(live): add undo',
      'docs(spec): describe undo',
    );
    expect(pickBump(pushed, false)).toBe('minor');
  });

  it('skips the bot bump commits', () => {
    expect(
      pickBump(
        kinds('Bump version: 0.3.0', 'fix(live): keep the frame'),
        false,
      ),
    ).toBe('patch');
    expect(pickBump(kinds('Bump version: 0.3.0'), false)).toBeNull();
  });

  it('counts a subject that breaks the format as a patch change', () => {
    expect(pickBump(kinds('Update stuff'), false)).toBe('patch');
  });

  it('raises the major whenever the user asked for it', () => {
    expect(pickBump(kinds('fix(live): keep the frame'), true)).toBe('major');
    expect(pickBump([], true)).toBe('major');
  });

  it('has nothing to bump without commits', () => {
    expect(pickBump([], false)).toBeNull();
  });
});

describe('bumpVersion', () => {
  const version = {major: 1, minor: 4, patch: 2};

  it('raises the major and resets the rest', () => {
    expect(bumpVersion(version, 'major')).toEqual({
      major: 2,
      minor: 0,
      patch: 0,
    });
  });

  it('raises the minor and resets the patch', () => {
    expect(bumpVersion(version, 'minor')).toEqual({
      major: 1,
      minor: 5,
      patch: 0,
    });
  });

  it('raises the patch', () => {
    expect(bumpVersion(version, 'patch')).toEqual({
      major: 1,
      minor: 4,
      patch: 3,
    });
  });
});
