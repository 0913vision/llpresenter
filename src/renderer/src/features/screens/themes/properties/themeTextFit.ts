import {
  THEME_FILE_LIMITS,
  type ThemeGroupedText,
} from '@core/schema/screens/theme';

/** The 긴 글 settings of a text of a theme. */
export type TextFit = NonNullable<ThemeGroupedText['fit']>;

/** A change of the 긴 글 settings; undefined or false takes a setting away. */
export type TextFitUpdate = {
  readonly [Key in keyof TextFit]?: TextFit[Key] | false | undefined;
};

/**
 * The size steps typed in 크기 단계: the numbers between commas, each once,
 * largest first, since the first step that fits is drawn; only font sizes, and
 * at most {@link THEME_FILE_LIMITS.sizeSteps}. None when nothing is typed.
 */
export function sizeSteps(text: string): number[] | undefined {
  const {min, max} = THEME_FILE_LIMITS.fontSize;
  const sizes = [...new Set(text.split(',').map(part => Number(part.trim())))]
    .filter(size => Number.isFinite(size) && size >= min && size <= max)
    .sort((a, b) => b - a)
    .slice(0, THEME_FILE_LIMITS.sizeSteps);
  return sizes.length === 0 ? undefined : sizes;
}

/**
 * The 긴 글 settings after `update`. A setting that is off is left out, and a
 * text with none of them has no settings at all.
 */
export function fitAfter(
  fit: TextFit | undefined,
  update: TextFitUpdate,
): TextFit | undefined {
  const next: TextFit = Object.fromEntries(
    Object.entries({...fit, ...update}).filter(
      ([, value]) => value !== undefined && value !== false,
    ),
  );
  return Object.keys(next).length === 0 ? undefined : next;
}
