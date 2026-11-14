import * as v from 'valibot';
import {jsonObject} from './primitives';
import type {ReadonlyKnown} from './fileFormat';

/** PowerPoint typography in 1920-wide reference canvas units. */
const finite = (min: number, max: number) =>
  v.pipe(v.number(), v.finite(), v.minValue(min), v.maxValue(max));
const run = jsonObject({
  text: v.pipe(v.string(), v.maxLength(4000)),
  size: v.exactOptional(finite(1, 1000)),
  tracking: v.exactOptional(finite(-100, 200)),
  weight: v.exactOptional(finite(1, 1000)),
  font: v.exactOptional(v.pipe(v.string(), v.maxLength(256))),
});
const spacing = v.variant('kind', [
  v.object({kind: v.literal('ratio'), value: finite(0.01, 10)}),
  v.object({kind: v.literal('pixels'), value: finite(1, 2000)}),
]);
const line = jsonObject({
  boxWidth: finite(1, 3840),
  left: v.exactOptional(finite(-3840, 3840)),
  top: v.exactOptional(finite(0, 1080)),
  runs: v.pipe(v.array(run), v.minLength(1), v.maxLength(256)),
  spacing: v.exactOptional(spacing),
});
export const songLyricFormatSchema = v.pipe(
  jsonObject({
    lines: v.pipe(v.array(line), v.minLength(1), v.maxLength(1000)),
  }),
  v.check(
    value => value.lines.reduce((n, entry) => n + entry.runs.length, 0) <= 5000,
    'Too many formatting runs',
  ),
  v.check(
    value =>
      value.lines.reduce(
        (n, entry) =>
          n + entry.runs.reduce((sum, part) => sum + part.text.length, 0),
        0,
      ) <= 200000,
    'Formatted text is too long',
  ),
);
export type SongLyricFormat = ReadonlyKnown<
  v.InferOutput<typeof songLyricFormatSchema>
>;
