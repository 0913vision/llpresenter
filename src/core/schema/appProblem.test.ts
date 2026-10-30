import {describe, expect, it} from 'vitest';
import {
  APP_PROBLEM_LIMITS,
  fileSkippedProblem,
  macroDroppedProblem,
  parseAppProblem,
  parseAppProblems,
  saveFailedProblem,
} from './appProblem';
import {macroIdSchema} from './ids';
import {testId} from './testHelpers';

const MACRO_ID = 'c63a2e74-9a31-4c4d-8e5f-607182930415';

describe('app problem payloads', () => {
  it('reads a dropped 매크로 and strips unknown fields', () => {
    expect(
      parseAppProblem({
        kind: 'macro-dropped',
        macroId: MACRO_ID,
        name: '예배 시작',
        extra: true,
      }),
    ).toEqual({
      ok: true,
      value: {kind: 'macro-dropped', macroId: MACRO_ID, name: '예배 시작'},
    });
  });

  it.each([
    {kind: 'save-failed', name: 'songs.llsong', count: 1},
    {kind: 'save-failed', name: 'x', count: 1000},
    {kind: 'save-recovered'},
  ])('reads %j', value => {
    expect(parseAppProblem(value)).toEqual({ok: true, value});
  });

  it.each([
    {kind: 'save-failed', name: '', count: 1},
    {kind: 'save-failed', name: 'x', count: 0},
    {kind: 'save-failed', name: 'x', count: 1.5},
    {kind: 'save-failed', name: 'x', count: Number.MAX_SAFE_INTEGER + 1},
    {kind: 'save-failed', count: 1},
  ])('rejects the save problem %j', value => {
    expect(parseAppProblem(value).ok).toBe(false);
  });

  it('builds a save problem that cuts a long name', () => {
    const problem = saveFailedProblem(
      'y'.repeat(APP_PROBLEM_LIMITS.nameCharacters + 5),
      2,
    );
    expect(problem).toEqual({
      kind: 'save-failed',
      name: 'y'.repeat(APP_PROBLEM_LIMITS.nameCharacters),
      count: 2,
    });
    expect(parseAppProblem(problem).ok).toBe(true);
  });

  it('accepts a name at the limit', () => {
    const name = 'x'.repeat(APP_PROBLEM_LIMITS.nameCharacters);
    expect(
      parseAppProblem({kind: 'macro-dropped', macroId: MACRO_ID, name}).ok,
    ).toBe(true);
  });

  it.each([
    null,
    [],
    'macro-dropped',
    {kind: 'disk-full', macroId: MACRO_ID, name: 'x'},
    {kind: 'file-skipped'},
    {kind: 'file-skipped', fileId: 1, name: ''},
    {kind: 'file-skipped', name: 'looks.json'},
    {kind: 'file-skipped', fileId: 0, name: 'looks.json'},
    {kind: 'file-skipped', fileId: 1.5, name: 'looks.json'},
    {
      kind: 'file-skipped',
      fileId: APP_PROBLEM_LIMITS.listed + 1,
      name: 'looks.json',
    },
    {
      kind: 'file-skipped',
      fileId: 1,
      name: 'x'.repeat(APP_PROBLEM_LIMITS.nameCharacters + 1),
    },
    {kind: 'macro-dropped', macroId: 'not-a-uuid', name: 'x'},
    {kind: 'macro-dropped', macroId: MACRO_ID},
    {kind: 'macro-dropped', macroId: MACRO_ID, name: 7},
    {
      kind: 'macro-dropped',
      macroId: MACRO_ID,
      name: 'x'.repeat(APP_PROBLEM_LIMITS.nameCharacters + 1),
    },
  ])('rejects %j', value => {
    expect(parseAppProblem(value).ok).toBe(false);
  });

  it('reads a bounded list of problems', () => {
    const problem = {kind: 'macro-dropped', macroId: MACRO_ID, name: 'x'};
    expect(parseAppProblems([])).toEqual({ok: true, value: []});
    expect(parseAppProblems([problem, problem])).toEqual({
      ok: true,
      value: [problem, problem],
    });
    expect(
      parseAppProblems(
        Array.from({length: APP_PROBLEM_LIMITS.listed}, () => problem),
      ).ok,
    ).toBe(true);
    for (const value of [
      null,
      problem,
      [problem, {kind: 'unknown'}],
      Array.from({length: APP_PROBLEM_LIMITS.listed + 1}, () => problem),
    ]) {
      expect(parseAppProblems(value).ok).toBe(false);
    }
  });

  it('builds a dropped 매크로 problem that cuts a long name at a whole character', () => {
    const macroId = testId(macroIdSchema, MACRO_ID);
    const short = macroDroppedProblem(macroId, '광고');
    expect(short).toEqual({kind: 'macro-dropped', macroId, name: '광고'});
    const pairs = '😀'.repeat(APP_PROBLEM_LIMITS.nameCharacters);
    const long = macroDroppedProblem(macroId, `x${pairs}`);
    expect(long.name).toHaveLength(APP_PROBLEM_LIMITS.nameCharacters - 1);
    expect(long.name.startsWith('x😀')).toBe(true);
    expect(parseAppProblem(long)).toEqual({ok: true, value: long});
  });
});

describe('fileSkippedProblem', () => {
  it.each([
    ['D:\\예배 데이터\\Songs\\a1.llsong', 'a1.llsong'],
    ['/data/settings/screens.json', 'screens.json'],
    ['looks.json', 'looks.json'],
  ])('names %s by its file name %s', (file, name) => {
    const problem = fileSkippedProblem(3, file);
    expect(problem).toEqual({kind: 'file-skipped', fileId: 3, name});
    expect(parseAppProblem(problem).ok).toBe(true);
  });

  it('cuts a long file name at a whole character within the limit', () => {
    const name = `${'가'.repeat(APP_PROBLEM_LIMITS.nameCharacters)}.json`;
    const problem = fileSkippedProblem(1, `C:\\data\\${name}`);
    expect(problem.name).toBe('가'.repeat(APP_PROBLEM_LIMITS.nameCharacters));
    expect(parseAppProblem(problem).ok).toBe(true);
  });

  it('reads a file problem and strips unknown fields', () => {
    expect(
      parseAppProblem({
        kind: 'file-skipped',
        fileId: 2,
        name: 'looks.json',
        file: 'x',
      }),
    ).toEqual({
      ok: true,
      value: {kind: 'file-skipped', fileId: 2, name: 'looks.json'},
    });
  });
});
