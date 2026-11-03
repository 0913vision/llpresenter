import {NO_LABEL_COLOR} from '../labels/colors';
import type {BibleLookupPassage} from '../schema/bibleLookup';
import type {BiblePassage} from '../schema/biblePassage';
import {LIVE_STATE_LIMITS} from '../schema/liveLimits';
import type {ShowTile} from '../schema/showService';

function outputLines(text: string): readonly string[] {
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

type Verse = BibleLookupPassage['verses'][number];

/** The verses a slide shows, as `3:34` or as a span, `3:36-4:1`. */
function spanOf(verses: readonly Verse[]): string {
  const first = verses[0];
  const last = verses.at(-1);
  if (first === undefined || last === undefined) return '';
  const start = `${first.chapter}:${first.verse}`;
  if (verses.length === 1) return start;
  return first.chapter === last.chapter
    ? `${start}-${last.verse}`
    : `${start}-${last.chapter}:${last.verse}`;
}

/** How a passage becomes slides. */
export interface TileOptions {
  /** Whether each verse starts with its number; true when absent. */
  readonly verseNumbers?: boolean;
  /** Which slides show the reference; none when absent. */
  readonly reference?: BiblePassage['reference'];
  /** A verse each when absent, as the builder always made. */
  readonly split?: BiblePassage['split'];
  /** The most lines a slide of a `fit` passage holds; 4 when absent. */
  readonly maxLines?: number | undefined;
}

interface GroupRule {
  readonly split: BiblePassage['split'];
  readonly maxLines: number;
  readonly linesOf: (verse: Verse) => number;
}

/**
 * Groups the verses of a passage into slides: a verse each, two each, or
 * as many as fit in `maxLines` lines of the slide (a verse is one line, more
 * when its text is long; a verse that alone passes the limit stands alone).
 */
function groupsOf(
  verses: readonly Verse[],
  {split, maxLines, linesOf}: GroupRule,
): ReadonlyArray<readonly Verse[]> {
  if (split === 'verse') return verses.map(verse => [verse]);
  const groups: Verse[][] = [];
  let used = 0;
  for (const verse of verses) {
    const need = linesOf(verse);
    const current = groups.at(-1);
    const fits =
      split === 'two'
        ? current !== undefined && current.length < 2
        : current !== undefined && used + need <= maxLines;
    if (current !== undefined && fits) {
      current.push(verse);
      used += need;
    } else {
      groups.push([verse]);
      used = need;
    }
  }
  return groups;
}

/**
 * The slides of a passage. With the default `verse` split, one slide per verse,
 * which is what the builder always made; `two` and `fit` pack neighboring
 * verses into a slide. The reference shows on every slide, the first, the
 * last, or none.
 */
export function bibleVerseTiles(
  passage: BibleLookupPassage,
  options: TileOptions = {},
): readonly ShowTile[] {
  const {
    verseNumbers = true,
    reference = 'none',
    split = 'verse',
    maxLines = 4,
  } = options;
  const text = (verse: Verse): string =>
    verseNumbers ? `${verse.verse} ${verse.text}` : verse.text;
  const groups = groupsOf(passage.verses, {
    split,
    maxLines,
    linesOf: verse => outputLines(text(verse)).length,
  });
  return groups.map((group, index) => ({
    label: spanOf(group),
    labelColor: NO_LABEL_COLOR,
    ...(reference === 'every' ||
    (reference === 'first' && index === 0) ||
    (reference === 'last' && index === groups.length - 1)
      ? {reference: spanOf(group)}
      : {}),
    lines: group.flatMap(verse => outputLines(text(verse))),
  }));
}
