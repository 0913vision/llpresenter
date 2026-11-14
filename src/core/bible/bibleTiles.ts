import {passageBook} from './adjacentVerses';
import {NO_LABEL_COLOR} from '../labels/colors';
import type {BibleLookupPassage} from '../schema/bibleLookup';
import type {BiblePassage} from '../schema/biblePassage';
import {LIVE_STATE_LIMITS} from '../schema/liveLimits';
import type {ShowTile} from '../schema/showService';

export function bibleOutputLines(text: string): readonly string[] {
  const lines: string[] = [];
  let line = '';
  for (const character of text) {
    if (line.length + character.length > LIVE_STATE_LIMITS.textCharacters) {
      lines.push(line);
      line = '';
    }
    line += character;
  }
  lines.push(line);
  return lines;
}

/**
 * The chapter and verse at either end of a current or legacy slide label,
 * such as `3:34`, `3:34-36`, or `3:36-4:1`.
 */
export function labelEdge(
  label: string | null | undefined,
  edge: 'first' | 'last',
): string | undefined {
  const reference = label?.match(/\d+:\d+(?:[-~\uFF5E](?:\d+:)?\d+)?/u)?.[0];
  const [from, to] = reference?.split(/[-~\uFF5E]/u) ?? [];
  if (edge === 'first' || to === undefined) return from;
  return to.includes(':') ? to : `${from?.split(':')[0]}:${to}`;
}

/** How a passage becomes slides. */
export interface TileOptions {
  /** Whether each verse starts with its number; true when absent. */
  readonly verseNumbers?: boolean;
  readonly translationName?: boolean;
  /** Which slides show the reference; none when absent. */
  readonly reference?: BiblePassage['reference'];
  /** Legacy packing value; each verse starts a slide regardless of this value. */
  readonly split?: BiblePassage['split'];
}

/**
 * The unmeasured fallback slides, one per verse. Measured projection can split
 * a long verse further. The reference shows on every slide, first, last, or none.
 */
export function bibleVerseTiles(
  passage: BibleLookupPassage,
  options: TileOptions = {},
): readonly ShowTile[] {
  const {
    verseNumbers = true,
    translationName = false,
    reference = 'none',
  } = options;
  const shortBook = passageBook(passage)?.koreanShort ?? '';
  const book = passage.displayRef.replace(/\s+\d.*$/u, '');
  const translation =
    translationName && passage.translationLabel
      ? ` (${passage.translationLabel})`
      : '';
  return passage.verses.map((verse, index) => ({
    label: `${shortBook}${verse.chapter}:${verse.verse}`,
    labelColor: NO_LABEL_COLOR,
    ...(reference === 'every' ||
    (reference === 'first' && index === 0) ||
    (reference === 'last' && index === passage.verses.length - 1)
      ? {reference: `${book} ${verse.chapter}:${verse.verse}${translation}`}
      : {}),
    lines: bibleOutputLines(
      verseNumbers ? `${verse.verse} ${verse.text}` : verse.text,
    ),
  }));
}
