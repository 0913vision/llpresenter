import * as v from 'valibot';
import {macroIdSchema, type MacroId} from './ids';
import {parsePayload, plainObject} from './payload';

/**
 * Bounds for the problems that main reports to the windows. `listed` is well
 * above the startup file problems that settings and content can report.
 */
export const APP_PROBLEM_LIMITS = {nameCharacters: 200, listed: 64} as const;

const nameSchema = v.pipe(
  v.string(),
  v.maxLength(APP_PROBLEM_LIMITS.nameCharacters),
);

const appProblemSchema = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({
      kind: v.literal('macro-dropped'),
      macroId: macroIdSchema,
      name: nameSchema,
    }),
  ]),
);

const appProblemListSchema = v.pipe(
  v.array(appProblemSchema),
  v.maxLength(APP_PROBLEM_LIMITS.listed),
);

/**
 * A problem that main reports to the windows for a notification card, one
 * kind at a time. `macro-dropped`: a dispatch that ran this 매크로 was dropped
 * whole, because its result would break the live state limits (spec 08,
 * 매크로 적용 실패); `name` is the 매크로's name when it ran.
 */
export type AppProblem = Readonly<v.InferOutput<typeof appProblemSchema>>;

/** Checks an `app:problem` push. Unknown fields are dropped. Never throws. */
export function parseAppProblem(value: unknown) {
  return parsePayload(appProblemSchema, value);
}

/** Checks an `app:problem:list` reply. Never throws. */
export function parseAppProblems(value: unknown) {
  return parsePayload(appProblemListSchema, value);
}

function clipped(text: string, length: number): string {
  let kept = '';
  for (const character of text) {
    if (kept.length + character.length > length) break;
    kept += character;
  }
  return kept;
}

/**
 * The problem for a 매크로 in a dropped dispatch. A name over the limit is cut
 * at a whole character.
 */
export function macroDroppedProblem(
  macroId: MacroId,
  name: string,
): AppProblem {
  return {
    kind: 'macro-dropped',
    macroId,
    name: clipped(name, APP_PROBLEM_LIMITS.nameCharacters),
  };
}
