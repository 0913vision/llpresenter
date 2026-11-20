import {passageBook} from './adjacentVerses';
import {NO_LABEL_COLOR} from '../labels/colors';
import type {BibleLookupPassage} from '../schema/bibleLookup';
import type {BiblePassage} from '../schema/biblePassage';
import {LIVE_STATE_LIMITS} from '../schema/liveLimits';
import type {ShowTile} from '../schema/showService';
import {cacheKey} from './split/splitCache';
import {CONT_MARKER} from './split/layout';

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

/** Edited text has the same hard line breaks as the other slide editors. */
export function bibleEditedOutputLines(
  text: string,
  prefix: string,
  continued: boolean,
): readonly string[] {
  return (prefix + text + (continued ? CONT_MARKER : ''))
    .split(/\r?\n/u)
    .flatMap(bibleOutputLines);
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
  readonly editedVerses?: BiblePassage['editedVerses'];
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
    const edited =
      bibleVerse === undefined
        ? undefined
        : options.editedVerses?.[cacheKey(bibleVerse)];
    const base = {
      label: `${shortBook}${verse.chapter}:${verse.verse}`,
      labelColor: NO_LABEL_COLOR,
      ...(bibleVerse === undefined ? {} : {bibleVerse}),
      ...(options.transition === undefined
        ? {}
        : {transition: options.transition}),
      reference: `${book} ${verse.chapter}:${verse.verse}${translation}`,
    };
    if (edited === undefined) {
      return [
        {
          ...base,
          lines: bibleOutputLines(
            verseNumbers ? `${verse.verse} ${verse.text}` : verse.text,
          ),
        },
      ];
    }
    return edited.map((part, index) => {
      const continued = index < edited.length - 1;
      const prefix =
        index === 0 && verseNumbers && passage.verses.length > 1
          ? `${verse.verse} `
          : '';
      return {
        ...base,
        label:
          edited.length === 1 ? base.label : `${base.label} (${index + 1})`,
        biblePart: index + 1,
        continued,
        lines: bibleEditedOutputLines(
          part.text ?? part.source.trimEnd(),
          prefix,
          continued,
        ),
      };
    });
  });
  return tiles.map((tile, index) => {
    if (
      reference === 'every' ||
      (reference === 'first' && index === 0) ||
      (reference === 'last' && index === tiles.length - 1)
    ) {
      return tile;
    }
    const {reference: _reference, ...rest} = tile;
    return rest;
  });
}
