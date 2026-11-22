import type {ShowTile} from '@core/schema/showService';
import type {Slide} from '@core/schema/slide';
import {AUTO_TOKENS} from '@core/schema/slideContent';
import type {ThemeFile} from '@core/schema/theme';
import {contentValues, nextPhraseOf} from '@core/theme';
import {withNext, withText} from './edits';
import {tileContent} from './tiles';

/** The box of the text that the slide before shows, after those of a theme. */
export const NEXT_BOX = '미리 보여줄 내용';

/** Every box a slide of a theme has, in their order. */
export function boxesOf(theme: ThemeFile): readonly string[] {
  return [...theme.boxes.map(box => box.name), NEXT_BOX];
}

/** Whether a box fills itself, so that a slide rarely has a text for it. */
export function fillsItself(theme: ThemeFile, box: string): boolean {
  return (
    box === NEXT_BOX ||
    theme.boxes.find(entry => entry.name === box)?.default !== undefined
  );
}

const HYMN_VALUES = [AUTO_TOKENS.hymnNumber, AUTO_TOKENS.hymnTitle];

/** Whether a theme writes the hymn that its slides are the titles of. */
export function showsHymn(theme: ThemeFile): boolean {
  return theme.boxes.some(box =>
    HYMN_VALUES.some(value => box.default?.includes(`{${value}}`)),
  );
}

/** The text a slide has of its own for a box; empty for none. */
export function ownText(slide: Slide, box: string): string {
  return (box === NEXT_BOX ? slide.next : slide.texts[box]) ?? '';
}

export function withOwnText(slide: Slide, box: string, text: string): Slide {
  return box === NEXT_BOX ? withNext(slide, text) : withText(slide, box, text);
}

/** What a box shows while the slide has no text of its own for it. */
export function filledText(
  theme: ThemeFile,
  tile: ShowTile,
  {box, first}: {readonly box: string; readonly first: boolean},
): string {
  return box === NEXT_BOX
    ? (nextPhraseOf(theme, tileContent(tile), first) ?? '')
    : (contentValues(theme, {texts: {}, auto: tile.auto})(box) ?? '');
}
