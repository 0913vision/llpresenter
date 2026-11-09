import {continuationText} from '../bible/split/continuation';
import type {TextStyle} from './textStyle';

type TrackingStyle = Pick<TextStyle, 'tracking' | 'shortTracking' | 'align'>;

/** Resolves per-name spacing before the short-text rule and its center offset. */
export function resolveTextTracking(
  style: TrackingStyle,
  content: string,
  continued = false,
) {
  const base = style.tracking ?? 0;
  const option = style.shortTracking;
  if (option === undefined) return {spacing: base, indent: 0};
  const lines = content.split(/\r?\n/);
  if (continued) {
    const last = lines.length - 1;
    lines[last] = continuationText(lines[last] ?? '', true).body;
  }
  const name = lines.join('').replace(/\s/gu, '');
  const override = option.overrides?.find(override => override.text === name);
  if (override !== undefined) return {spacing: override.tracking, indent: 0};
  const count = Array.from(name).length;
  const spacing =
    count > 0 && count <= option.maxCharacters ? option.tracking : base;
  return {spacing, indent: style.align === 'center' ? spacing - base : 0};
}
