import type {CSSProperties} from 'react';
import {NO_LABEL_COLOR, type LabelColor} from '@core/labels/colors';

/** The fill and text colors of an 이름표, as CSS variables on an element. */
export type LabelInkStyle = CSSProperties &
  Readonly<Record<'--label-fill' | '--label-ink', string>>;

/** Chooses the higher WCAG contrast against dark or white ink. */
export function labelInk(color: LabelColor): LabelInkStyle {
  if (color === NO_LABEL_COLOR) {
    return {
      '--label-fill': 'var(--label-none)',
      '--label-ink': 'var(--label-gray)',
    };
  }
  const channels = [1, 3, 5].map(index => {
    const channel = parseInt(color.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels.reduce(
    (sum, channel, index) =>
      sum + channel * ([0.2126, 0.7152, 0.0722][index] ?? 0),
    0,
  );
  const darkLuminance = ((16 / 255 + 0.055) / 1.055) ** 2.4;
  const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);
  const lightContrast = 1.05 / (luminance + 0.05);
  return {
    '--label-fill': color,
    '--label-ink':
      darkContrast >= lightContrast
        ? 'var(--text-on-label)'
        : 'var(--text-on-fill)',
  };
}
