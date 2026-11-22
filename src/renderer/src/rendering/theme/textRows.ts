import type {ThemeTextStyle} from '@core/schema/theme';
import {CONT_MARKER, contSizeOf} from '@core/bible/split/layout';
import {fontFamilyFor} from '../fontFamily';
import styles from './theme.module.css';

/** The text of one element, as it is drawn and measured. */
export interface RowsText {
  readonly text: string;
  readonly style: ThemeTextStyle;
  readonly width: number;
  readonly wrap: 'normal' | 'balance';
  /** The text goes on on the next slide. */
  readonly continued: boolean;
  /** Shown in front of the first row, smaller than nothing else. */
  readonly prefix?: string | undefined;
}

const NO_BREAK_SPACE = ' ';

/** The tracking of a text, which a theme may set apart for short ones. */
function trackingOf(
  style: ThemeTextStyle,
  text: string,
): {readonly tracking: number; readonly indent: number} {
  const {short, tracking} = style;
  if (short === undefined) return {tracking, indent: 0};
  const letters = text.replace(/\s/gu, '');
  const named = short.texts?.[letters];
  if (named !== undefined) return {tracking: named, indent: 0};
  const count = Array.from(letters).length;
  if (count === 0 || count > short.letters) return {tracking, indent: 0};
  return {
    tracking: short.tracking,
    indent: style.align === 'center' ? short.tracking - tracking : 0,
  };
}

/** Sets everything about a text but its size and place. */
export function writeRows(block: HTMLElement, rows: RowsText): void {
  const {style, text, continued} = rows;
  const {tracking, indent} = trackingOf(style, text);
  block.className = styles.rows ?? '';
  Object.assign(block.style, {
    fontFamily: fontFamilyFor(style.font),
    fontWeight: String(style.weight),
    lineHeight: String(style.lineHeight),
    letterSpacing: `${tracking}px`,
    textIndent: `${indent}px`,
    textAlign: style.align,
    color: style.color,
    textShadow: shadowOf(style),
    webkitTextStroke:
      style.outline?.on === true
        ? `${style.outline.width}px ${style.outline.color}`
        : '',
  });
  block.dataset['wrap'] = rows.wrap;
  const paragraphs = text.split(/\r?\n/u);
  block.replaceChildren(
    ...paragraphs.map((paragraph, index) => {
      const row = document.createElement('div');
      const last = index === paragraphs.length - 1;
      row.textContent =
        paragraph === '' && !(continued && last) ? NO_BREAK_SPACE : paragraph;
      if (style.bullets === true && paragraph.trim() !== '') {
        row.className = styles.bullet ?? '';
      }
      if (index === 0 && rows.prefix !== undefined) {
        const prefix = document.createElement('span');
        prefix.textContent = rows.prefix;
        row.prepend(prefix);
      }
      if (continued && last) {
        const marker = document.createElement('span');
        marker.dataset['continuation'] = '';
        marker.textContent = CONT_MARKER;
        row.append(marker);
      }
      return row;
    }),
  );
}

function shadowOf({shadow}: ThemeTextStyle): string {
  if (shadow?.on !== true) return '';
  const angle = (shadow.angle * Math.PI) / 180;
  const x = Math.cos(angle) * shadow.distance;
  const y = Math.sin(angle) * shadow.distance;
  return `${x}px ${y}px ${shadow.blur}px color-mix(in srgb, ${shadow.color} ${shadow.opacity}%, transparent)`;
}

/** Sets the size of a written text, and whether its rows may wrap. */
export function sizeRows(
  block: HTMLElement,
  size: number,
  keepRows: boolean,
): void {
  block.style.fontSize = `${size}px`;
  block.dataset['keepRows'] = String(keepRows);
  for (const marker of block.querySelectorAll<HTMLElement>(
    '[data-continuation]',
  )) {
    marker.style.fontSize = `${contSizeOf({size})}px`;
  }
}

/** The rows a written text takes, as they wrapped. */
export function wrappedRows(block: HTMLElement): readonly string[] {
  return [...block.children].flatMap(rowTexts);
}

/** The letters of a row with where they ended up, in order. */
function* lettersOf(row: Element): Iterable<{
  readonly letter: string;
  readonly rect: DOMRect | undefined;
}> {
  const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let at = 0;
    for (const letter of node.textContent ?? '') {
      range.setStart(node, at);
      at += letter.length;
      range.setEnd(node, at);
      yield {letter, rect: range.getClientRects()[0]};
    }
  }
}

function rowTexts(row: Element): string[] {
  const rows: string[] = [];
  let line = '';
  let bottom: number | undefined;
  for (const {letter, rect} of lettersOf(row)) {
    if (rect !== undefined && rect.width > 0 && rect.height > 0) {
      if (bottom !== undefined && rect.top >= bottom - 2) {
        rows.push(line.trimEnd());
        line = '';
      }
      bottom = rect.bottom;
    }
    line += letter;
  }
  rows.push(line.trimEnd());
  return rows;
}
