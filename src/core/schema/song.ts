import * as v from 'valibot';
import {nonBlankText} from './primitives';

export const SONG_NAME_MAX_LENGTH = 512;

/** The name of the default 구성. It is never stored, so no 구성 may use it. */
export const DEFAULT_ARRANGEMENT_NAME = '기본';

/** A stored 구성 name: not blank, and never the default 구성's name. */
export const arrangementNameSchema = v.pipe(
  nonBlankText,
  v.notValue(
    DEFAULT_ARRANGEMENT_NAME,
    `"${DEFAULT_ARRANGEMENT_NAME}" is the default arrangement's name`,
  ),
);

/** Whether a text can name a stored 구성. */
export function isArrangementName(value: string): boolean {
  return v.is(arrangementNameSchema, value);
}
