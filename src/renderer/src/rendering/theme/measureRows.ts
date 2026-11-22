import type {MeasuredText, TextMetrics} from '@core/theme/layout';
import {fontFamilyFor} from '../fontFamily';
import {sizeRows, wrappedRows, writeRows, type RowsText} from './textRows';

const MAX_ENTRIES = 4096;

interface Ink {
  readonly top: number;
  readonly bottom: number;
}

interface Measured extends TextMetrics {
  readonly rows: number;
}

/**
 * Lays texts out away from the screen, with the same rows that are drawn. A
 * measure is kept until the fonts of the window change.
 */
class RowsMeasurer {
  private readonly host = document.createElement('div');
  private readonly block = document.createElement('div');
  private readonly sizes = new Map<string, Measured>();
  private readonly rows = new Map<string, readonly string[]>();
  private written = '';

  constructor() {
    Object.assign(this.host.style, {
      position: 'fixed',
      left: '-20000px',
      top: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      contain: 'layout style',
    });
    this.host.dataset['themeMeasure'] = '';
    this.host.append(this.block);
    document.body.append(this.host);
    document.fonts.addEventListener('loadingdone', () => {
      this.sizes.clear();
      this.rows.clear();
    });
  }

  measure(
    key: string,
    text: RowsText,
    {size, keep}: {readonly size: number; readonly keep: boolean},
  ): Measured {
    const entry = `${size}|${keep}|${key}`;
    const known = this.sizes.get(entry);
    if (known !== undefined) return known;
    this.write(key, text);
    sizeRows(this.block, size, keep);
    const rowHeight = size * text.style.lineHeight;
    const rows = Math.max(1, Math.round(this.block.offsetHeight / rowHeight));
    const measured = {
      rows,
      height: rows * rowHeight,
      width: this.block.scrollWidth,
    };
    if (this.sizes.size >= MAX_ENTRIES) this.sizes.clear();
    this.sizes.set(entry, measured);
    return measured;
  }

  wrapped(key: string, text: RowsText, size: number): readonly string[] {
    const entry = `${size}|${key}`;
    const known = this.rows.get(entry);
    if (known !== undefined) return known;
    this.write(key, text);
    sizeRows(this.block, size, false);
    const rows = wrappedRows(this.block);
    if (this.rows.size >= MAX_ENTRIES) this.rows.clear();
    this.rows.set(entry, rows);
    return rows;
  }

  private write(key: string, text: RowsText): void {
    if (this.written === key) return;
    this.written = key;
    this.block.style.width = `${text.width}px`;
    writeRows(this.block, text);
  }
}

let measurer: RowsMeasurer | undefined;

function shared(): RowsMeasurer {
  measurer ??= new RowsMeasurer();
  return measurer;
}

let context: CanvasRenderingContext2D | null | undefined;

/** Where the letters of a row start and end around its baseline. */
function inkOf(text: RowsText, row: string, size: number) {
  context ??= document.createElement('canvas').getContext('2d');
  if (!context) return {above: size, below: 0, ascent: size, descent: 0};
  const {style} = text;
  context.font = `${style.weight} ${size}px ${fontFamilyFor(style.font)}`;
  const metrics = context.measureText(row === '' ? ' ' : row);
  return {
    above: metrics.actualBoundingBoxAscent,
    below: metrics.actualBoundingBoxDescent,
    ascent: metrics.fontBoundingBoxAscent,
    descent: metrics.fontBoundingBoxDescent,
  };
}

function inkBounds(text: RowsText, rows: readonly string[], size: number): Ink {
  const rowHeight = size * text.style.lineHeight;
  const first = inkOf(text, rows[0] ?? '', size);
  const last = inkOf(text, rows.at(-1) ?? '', size);
  const baseline =
    (rowHeight - (first.ascent + first.descent)) / 2 + first.ascent;
  return {
    top: baseline - first.above,
    bottom: (rows.length - 1) * rowHeight + baseline + last.below,
  };
}

/** Keys everything that changes how a text wraps. */
function keyOf(text: RowsText): string {
  const {style} = text;
  return JSON.stringify([
    text.text,
    text.width,
    text.wrap,
    text.continued,
    text.prefix,
    style.font,
    style.weight,
    style.lineHeight,
    style.tracking,
    style.short,
    style.align,
    style.bullets,
  ]);
}

/** Measures a text, and the texts that are sized together with it. */
export function measuredText(
  text: RowsText,
  peers: readonly RowsText[] = [],
): MeasuredText & {readonly wrapped: (size: number) => readonly string[]} {
  const key = keyOf(text);
  const others = peers.map(peer => [keyOf(peer), peer] as const);
  return {
    at: (size, keep) => shared().measure(key, text, {size: size, keep: keep}),
    ...(others.length === 0
      ? {}
      : {
          together: (size, keep) => {
            let height = 0;
            let width = 0;
            for (const [other, peer] of others) {
              const metrics = shared().measure(other, peer, {
                size: size,
                keep: keep,
              });
              height = Math.max(height, metrics.height);
              width = Math.max(width, metrics.width);
            }
            return {height, width};
          },
        }),
    ink: size => inkBounds(text, shared().wrapped(key, text, size), size),
    wrapped: size => shared().wrapped(key, text, size),
  };
}
