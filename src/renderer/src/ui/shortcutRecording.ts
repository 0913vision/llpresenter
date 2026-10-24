/**
 * The attribute that marks a field while it records a shortcut. Window
 * shortcuts, the 지우기 keys F1 to F7 included, skip a key press inside it
 * (docs/spec/10-shortcuts-and-settings.md, focus precedence rule 1).
 */
export const SHORTCUT_RECORDING_ATTRIBUTE = 'data-shortcut-recording';

/** Matches a field that records a shortcut; test it with `closest`. */
export const SHORTCUT_RECORDING_SELECTOR = `[${SHORTCUT_RECORDING_ATTRIBUTE}]`;

/** Spread on a field while it records a shortcut. */
export const shortcutRecordingProps: Readonly<
  Record<typeof SHORTCUT_RECORDING_ATTRIBUTE, ''>
> = {[SHORTCUT_RECORDING_ATTRIBUTE]: ''};
