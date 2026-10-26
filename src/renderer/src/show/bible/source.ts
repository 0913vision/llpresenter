import type {BibleLookupPassage} from '@shared/schema/bibleLookup';
import {NO_LABEL_COLOR} from '@shared/colors';
import {LIVE_STATE_LIMITS} from '@shared/schema/liveLimits';
import type {SlideTile} from '../model';

export interface BibleSource {
  readonly id: string;
  readonly passage: BibleLookupPassage;
  readonly tiles: readonly SlideTile[];
}

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

export function bibleSource(passage: BibleLookupPassage): BibleSource {
  return {
    id: `bible:${passage.translation}:${passage.ref}`,
    passage,
    tiles: passage.verses.map(verse => ({
      label: `${verse.chapter}:${verse.verse}`,
      labelColor: NO_LABEL_COLOR,
      lines: outputLines(`${verse.verse} ${verse.text}`),
    })),
  };
}
