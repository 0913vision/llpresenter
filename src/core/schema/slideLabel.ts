import * as v from 'valibot';
import {SONG_LIMITS} from './song';

/** The 이름표 of one slide, whatever the item it is in. */
export const slideLabelSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(SONG_LIMITS.label),
);
