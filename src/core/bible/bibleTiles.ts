import {passageBook} from './adjacentVerses';
import {NO_LABEL_COLOR} from '../labels/colors';
import type {BibleLookupPassage} from '../schema/bibleLookup';
import type {BiblePassage} from '../schema/biblePassage';
import {LIVE_STATE_LIMITS} from '../schema/liveLimits';
import type {ShowTile} from '../schema/showService';
import {textSlideKey, textVerseKey} from '../presentation/textOverrides';
import {CONT_MARKER} from './split/layout';
import {validatedPinnedVerse} from './split/splitVerses';

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
  readonly transition?: BiblePassage['transition'] | undefined;
  readonly pinnedVerses?: BiblePassage['pinnedVerses'];
  readonly deletedSlides?: BiblePassage['deletedSlides'];
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
  const bookInfo = passageBook(passage);
  const shortBook = bookInfo?.koreanShort ?? '';
  const book = passage.displayRef.replace(/\s+\d.*$/u, '');
  const translation =
    translationName && passage.translationLabel
      ? ` (${passage.translationLabel})`
      : '';
  const tiles = passage.verses.flatMap((verse): ShowTile[] => {
    const bibleVerse =
      bookInfo === undefined
        ? undefined
        : {
            translation: passage.translation,
            book: bookInfo.id,
            chapter: verse.chapter,
            verse: verse.verse,
          };
    const pinned =
      bibleVerse === undefined
        ? undefined
        : validatedPinnedVerse(
            verse.text,
            options.pinnedVerses?.[textVerseKey(bibleVerse)],
          );
    const parts = pinned ?? [verse.text];
    return parts.map((part, index) => {
      const continued = index < parts.length - 1;
      const prefix =
        index === 0 &&
        verseNumbers &&
        (pinned === undefined || passage.verses.length > 1)
          ? `${verse.verse} `
          : '';
      return {
        ...(pinned === undefined ? {} : {biblePart: index + 1, continued}),
        label: `${shortBook}${verse.chapter}:${verse.verse}${parts.length > 1 ? ` (${index + 1})` : ''}`,
        ...(bibleVerse === undefined ? {} : {bibleVerse}),
        labelColor: NO_LABEL_COLOR,
        ...(options.transition === undefined
          ? {}
          : {transition: options.transition}),
        reference: `${book} ${verse.chapter}:${verse.verse}${translation}`,
        lines: bibleOutputLines(
          prefix +
            (pinned === undefined ? part : part.trimEnd()) +
            (continued ? CONT_MARKER : ''),
        ),
      };
    });
  });
  const visible = withoutDeletedBibleSlides(tiles, options.deletedSlides);
  return visible.map((tile, index) => {
    if (
      reference === 'every' ||
      (reference === 'first' && index === 0) ||
      (reference === 'last' && index === visible.length - 1)
    ) {
      return tile;
    }
    const {reference: _reference, ...other} = tile;
    return other;
  });
}

export function withoutDeletedBibleSlides(
  tiles: readonly ShowTile[],
  hidden: BiblePassage['deletedSlides'],
): readonly ShowTile[] {
  if (!hidden?.length) return tiles;
  const deleted = new Set(hidden);
  return tiles.filter(tile => {
    const key = textSlideKey(tile);
    return key === undefined || !deleted.has(key);
  });
}

export function sermonTitleTile({
  side,
  title,
  reference,
  label,
  transition,
}: {
  readonly side: 'opening' | 'closing';
  readonly title: string;
  readonly reference: string;
  readonly label: string | undefined;
  readonly transition: BiblePassage['transition'];
}): ShowTile {
  return {
    textSlideKey: `sermon:${side}`,
    label: label ?? null,
    ...(label === undefined ? {} : {slideLabel: label}),
    labelColor: NO_LABEL_COLOR,
    lines: title.split(/\r?\n/),
    reference,
    sermonTitle: true,
    ...(transition === undefined ? {} : {transition}),
  };
}
