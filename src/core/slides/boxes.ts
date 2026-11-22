import {tileContent} from '../presentation/slideLayer';
import type {ShowTile} from '../schema/showService';
import type {Slide} from '../schema/slide';
import type {ThemeFile} from '../schema/theme';
import {contentValues, nextPhraseOf} from '../theme/content';
import {withNext, withText} from './edits';

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
