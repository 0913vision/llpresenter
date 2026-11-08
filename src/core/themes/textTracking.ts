import {continuationText} from '../bible/split/continuation';

interface TrackingStyle {
  readonly tracking?: number;
  readonly shortTracking?: {
    readonly maxCharacters: number;
    readonly tracking: number;
  };
  readonly align: 'left' | 'center' | 'right';
}

/** Resolves short text spacing while keeping centered text on the same visual axis. */
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
  const count = Array.from(lines.join('').replace(/\s/gu, '')).length;
  const spacing =
    count > 0 && count <= option.maxCharacters ? option.tracking : base;
  return {spacing, indent: style.align === 'center' ? spacing - base : 0};
}
