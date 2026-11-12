export interface PowerPointPictureFilter {
  readonly kind: 'grayscale' | 'contrast' | 'brightness' | 'invert';
  readonly amount: number;
}

/** Expresses DrawingML luminance as canvas filters, preserving white/black endpoints. */
export function powerpointPictureFilters(effects: {
  readonly brightness: number;
  readonly contrast: number;
  readonly grayscale: boolean;
}): readonly PowerPointPictureFilter[] {
  const filters: PowerPointPictureFilter[] = [];
  if (effects.grayscale) filters.push({kind: 'grayscale', amount: 1});
  if (effects.contrast !== 0) {
    filters.push({kind: 'contrast', amount: Math.max(0, 1 + effects.contrast)});
  }
  const brightness = Math.max(-1, Math.min(1, effects.brightness));
  if (brightness > 0) {
    filters.push(
      {kind: 'invert', amount: 1},
      {kind: 'brightness', amount: 1 - brightness},
      {kind: 'invert', amount: 1},
    );
  } else if (brightness < 0) {
    filters.push({kind: 'brightness', amount: 1 + brightness});
  }
  return filters;
}
