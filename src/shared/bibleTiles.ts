import {NO_LABEL_COLOR} from './colors';
import type {BibleLookupPassage} from './schema/bibleLookup';
import {LIVE_STATE_LIMITS} from './schema/liveLimits';
import type {ShowTile} from './schema/showService';

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

/** The existing one-verse projection shared by saved and ad hoc passages. */
export function bibleVerseTiles(
  passage: BibleLookupPassage,
  verseNumbers = true,
): readonly ShowTile[] {
  return passage.verses.map(verse => ({
    label: `${verse.chapter}:${verse.verse}`,
    labelColor: NO_LABEL_COLOR,
    lines: outputLines(
      verseNumbers ? `${verse.verse} ${verse.text}` : verse.text,
    ),
  }));
}
