import * as v from 'valibot';
import {THEME_LIMITS} from '../themes/elementRules';
import {jsonObject} from './primitives';

export const DEFAULT_SONG_TITLE_LAYOUT = {
  titleTracking: 0,
  subtitleTracking: 24,
  titleTop: 181,
  subtitleTop: 345,
} as const;

const tracking = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(THEME_LIMITS.tracking.min),
  v.maxValue(THEME_LIMITS.tracking.max),
);

const top = (height: number) =>
  v.pipe(
    v.number(),
    v.finite(),
    v.minValue(0),
    v.maxValue(THEME_LIMITS.height - height),
  );

export const songTitleLayoutSchema = jsonObject({
  titleTracking: tracking,
  subtitleTracking: tracking,
  titleTop: v.exactOptional(top(160)),
  subtitleTop: v.exactOptional(top(90)),
});

export type SongTitleLayout = Readonly<
  v.InferOutput<typeof songTitleLayoutSchema>
>;
