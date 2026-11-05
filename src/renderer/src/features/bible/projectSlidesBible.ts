import {bibleOutputLines} from '@core/bible/bibleTiles';
import {
  splitVerseParts,
  type VerseInput,
  type VersePart,
} from '@core/bible/split/splitVerses';
import {SHOW_SERVICE_LIMITS} from '@core/schema/showService';
import {cacheKey} from '@core/bible/split/splitCache';
import type {SlideTile} from '@core/presentation/model';
import type {
  BibleProjection,
  ProjectionLayout,
  SplitSource,
} from './splitProjection';

/** Splits verse slots while keeping text and picture slots in their original order. */
export function projectSlidesBible(
  source: Extract<SplitSource, {kind: 'slides'}>,
  {element, layout, saved}: ProjectionLayout,
): BibleProjection {
  const numbered =
    source.verseNumbers &&
    source.input.filter(tile => tile.verse !== undefined).length > 1;
  const verses: VerseInput[] = [];
  const parts: VersePart[] = [];
  const partsByTile: Array<VersePart | null> = [];
  const tiles: SlideTile[] = [];
  const seen = new Set<string>();
  for (const raw of source.input) {
    const verse = raw.verse;
    if (verse?.text === undefined) {
      tiles.push(raw);
      partsByTile.push(null);
      continue;
    }
    const input = {reference: verse.reference, text: verse.text};
    const prefix = numbered ? `${verse.reference.verse} ` : '';
    const next = splitVerseParts(input, layout, {saved, prefix});
    if (tiles.length + next.length > SHOW_SERVICE_LIMITS.tiles) {
      return {
        source,
        element,
        layout,
        verses: [],
        parts: [],
        partsByTile: [],
        tiles: [],
        numbered,
        problem: 'tile-limit',
      };
    }
    const key = `${verse.reference.translation}:${cacheKey(verse.reference)}`;
    if (!seen.has(key)) {
      verses.push(input);
      parts.push(...next);
      seen.add(key);
    }
    const {verse: _verse, ...tile} = raw;
    next.forEach(part => {
      partsByTile.push(part);
      tiles.push({
        ...tile,
        lines:
          part.lines ??
          bibleOutputLines((part.part === 1 ? prefix : '') + part.display),
        biblePart: part.part,
        continued: part.continued,
      });
    });
  }
  return {source, element, layout, verses, parts, partsByTile, tiles, numbered};
}
