import type {ShowTile} from '../schema/showService';
import type {ItemTextOverrides} from '../schema/slideTextOverrides';
import {cacheKey} from '../bible/split/splitCache';
import type {VerseSlide} from '../schema/service';

export function textVerseKey(verse: VerseSlide['verse']): string {
  return `${verse.translation}:${cacheKey(verse)}`;
}

/** Identifies a particular slide within its service item. */
export function textSlideKey(tile: ShowTile): string | undefined {
  if (tile.textSlideKey !== undefined) return tile.textSlideKey;
  if (tile.sectionCard !== undefined) return 'section';
  const id = tile.sourceSlide?.slideId ?? tile.sourceSlideId;
  const part = tile.biblePart ?? 1;
  if (id !== undefined) {
    return `slide:${id}${tile.bibleVerse === undefined ? '' : `:${part}`}`;
  }
  const verse = tile.bibleVerse;
  return verse === undefined
    ? undefined
    : `verse:${textVerseKey(verse)}:${part}`;
}

export function textOverridesForTiles(
  tiles: readonly ShowTile[],
  overrides: ItemTextOverrides | undefined,
): readonly ShowTile[] {
  if (overrides === undefined) return tiles;
  return tiles.map(tile => {
    const key = textSlideKey(tile);
    const textOverrides = key === undefined ? undefined : overrides[key];
    return textOverrides === undefined ? tile : {...tile, textOverrides};
  });
}

export function editedSlideText(
  overrides: ItemTextOverrides | undefined,
  {
    slide,
    slot,
    text,
  }: {readonly slide: string; readonly slot: string; readonly text: string},
): ItemTextOverrides {
  const {[slide]: previous, ...otherSlides} = {...overrides};
  const {[slot]: _priorText, ...values} = {...previous};
  if (text.trim() !== '') values[slot] = text;
  return Object.keys(values).length === 0
    ? otherSlides
    : {...otherSlides, [slide]: values};
}
