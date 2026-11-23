import type {ShowTile} from '@core/schema/showService';
import type {Slide, VerseReference} from '@core/schema/slide';
import type {ThemeFile} from '@core/schema/theme';
import {sameVerse} from './edits';

type Tiles = ReadonlyArray<Pick<ShowTile, 'slide'>>;

/** Whether a verse is the one after another, or goes on from it. */
function goesOn(verse: VerseReference, after: VerseReference): boolean {
  if (sameVerse(verse, after)) return true;
  if (after.translation !== verse.translation || after.book !== verse.book) {
    return false;
  }
  return after.chapter === verse.chapter
    ? after.verse === verse.verse + 1
    : after.chapter === verse.chapter + 1 && after.verse === 1;
}

/** Whether a slide is the last of its list, or of one passage in it. */
function isEnd(tiles: Tiles, index: number): boolean {
  const after = tiles[index + 1]?.slide;
  if (after === undefined) return true;
  const verse = tiles[index]?.slide.verse;
  return (
    verse !== undefined &&
    (after.verse === undefined || !goesOn(verse, after.verse))
  );
}

/** Whether the theme of a slide lets it show nothing of the next slide. */
export function hidesNextByDefault(
  tiles: Tiles,
  index: number,
  theme: Pick<ThemeFile, 'hideNextAtEnd'>,
): boolean {
  return theme.hideNextAtEnd === true && isEnd(tiles, index);
}

/** Whether a slide shows nothing of the next slide. */
export function hidesNext(
  tiles: Tiles,
  index: number,
  theme: Pick<ThemeFile, 'hideNextAtEnd'>,
): boolean {
  return (
    tiles[index]?.slide.hideNext ?? hidesNextByDefault(tiles, index, theme)
  );
}

/** A slide that shows the next one or not; its theme's rule when it agrees. */
export function withHideNext(
  slide: Slide,
  hide: boolean,
  byDefault: boolean,
): Slide {
  const {hideNext: _hide, ...kept} = slide;
  return hide === byDefault ? kept : {...kept, hideNext: hide};
}
