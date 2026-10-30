import * as v from 'valibot';

/** A physical letter/digit key; absence, rather than null, means unassigned. */
export const slideHotKeySchema = v.pipe(
  v.string(),
  v.regex(
    /^(?:Key[A-Z]|Digit[0-9])$/,
    'Expected KeyA to KeyZ or Digit0 to Digit9',
  ),
);

export type SlideHotKey = v.InferOutput<typeof slideHotKeySchema>;
