import type {ShowTile} from '../schema/showService';
import type {
  ItemTextOverrides,
  ManualSlideText,
  SlideTextValue,
} from '../schema/slideTextOverrides';
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
    return `slide:${id}${part === 1 ? '' : `:${part}`}`;
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
    value,
  }: {
    readonly slide: string;
    readonly slot: string;
    readonly value: ManualSlideText | null;
  },
): ItemTextOverrides {
  const {[slide]: previous, ...otherSlides} = {...overrides};
  const {[slot]: _priorText, ...values} = {...previous};
  if (value !== null) values[slot] = value;
  return Object.keys(values).length === 0
    ? otherSlides
    : {...otherSlides, [slide]: values};
}

/** Legacy values have no provenance. A present empty value is still manual. */
export function slideTextValue(
  value: SlideTextValue | undefined,
): string | undefined {
  return typeof value === 'string' ? value : value?.text;
}
