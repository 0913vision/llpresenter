import type {CSSProperties} from 'react';
import {NO_LABEL_COLOR, type LabelColor} from '@shared/colors';

/** The fill and text colors of an 이름표, as CSS variables on an element. */
export type LabelInkStyle = CSSProperties &
  Readonly<Record<'--label-fill' | '--label-ink', string>>;

/**
 * The colors that chips, thumbnail bands, and macro tiles paint with: the
 * 이름표 color with `text-on-label`, or `label-none` with `label-gray` text
 * when there is no 이름표.
 */
export function labelInk(color: LabelColor): LabelInkStyle {
  return {
    '--label-fill': `var(--label-${color})`,
    '--label-ink':
      color === NO_LABEL_COLOR ? 'var(--label-gray)' : 'var(--text-on-label)',
  };
}
