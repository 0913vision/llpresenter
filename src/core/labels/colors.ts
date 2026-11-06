/** The fixed presets and macro palette (design tokens `label-*`). */
export const paletteColors = [
  'teal',
  'green',
  'yellow',
  'orange',
  'rose',
  'violet',
  'slate',
  'gray',
] as const;

export type PaletteColor = (typeof paletteColors)[number];

/** An 이름표 color stored as six hexadecimal channels, or no color. */
export type LabelColor = `#${string}` | 'none';

export const paletteHex: Readonly<Record<PaletteColor, LabelColor>> = {
  teal: '#5FB8C2',
  green: '#8FBF7A',
  yellow: '#D6B35F',
  orange: '#D68F5F',
  rose: '#D07A8A',
  violet: '#A99AE0',
  slate: '#7D8FD6',
  gray: '#A3A3A3',
};

/** Checks a stored label color without accepting palette names. */
export function isLabelColor(value: unknown): value is LabelColor {
  return (
    value === 'none' ||
    (typeof value === 'string' && /^#[\da-f]{6}$/i.test(value))
  );
}

/** A macro tile color. Tiles always have a color, so there is no `none`. */
export type MacroColor = PaletteColor;

export const NO_LABEL_COLOR = 'none' satisfies LabelColor;
