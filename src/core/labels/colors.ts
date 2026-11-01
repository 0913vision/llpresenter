/** The fixed palette for 이름표 and macro colors (design tokens `label-*`). */
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

/** An 이름표 color: a palette color, or `none` for no color. */
export type LabelColor = PaletteColor | 'none';

/** A macro tile color. Tiles always have a color, so there is no `none`. */
export type MacroColor = PaletteColor;

export const NO_LABEL_COLOR = 'none' satisfies LabelColor;
