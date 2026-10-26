import {describe, expect, it} from 'vitest';
import {
  APP_PROBLEM_LIMITS,
  macroDroppedProblem,
  parseAppProblem,
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
    {kind: 'file-skipped', macroId: MACRO_ID, name: 'x'},
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
