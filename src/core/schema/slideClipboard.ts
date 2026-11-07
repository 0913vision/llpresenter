import * as v from 'valibot';

export const SLIDE_CLIPBOARD_LIMITS = {
  characters: 1_000_000,
  slides: 10_000,
} as const;

export const slideClipboardTextSchema = v.pipe(
  v.string(),
  v.maxLength(SLIDE_CLIPBOARD_LIMITS.characters),
);
