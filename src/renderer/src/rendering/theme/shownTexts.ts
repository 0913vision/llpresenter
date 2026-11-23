import type {
  OwnThemeScreen,
  SlideBackground,
  ThemeElement,
  ThemeFile,
  ThemeNextElement,
  ThemeTextElement,
} from '@core/schema/theme';
import type {MediaLayer} from '@core/schema/live';
import {
  contentValues,
  fillTemplates,
  isLabelText,
  templateTokens,
} from '@core/theme';
import {AUTO_TOKENS, type SlideContent} from '@core/schema/slideContent';
import type {RowsText} from './textRows';

/** Where the label of a slide shows on 무대. */
export type LabelPlace = 'line' | 'inline' | 'off';

/** Everything that one screen shows of one slide. */
export interface ThemeDrawing {
  readonly theme: Pick<ThemeFile, 'id' | 'boxes'>;
  readonly screen: OwnThemeScreen;
  /** What the slide says; null once its texts are cleared. */
  readonly content: SlideContent | null;
  /** What the slide after this one lets it show, or null for nothing. */
  readonly next: string | null;
  readonly background: SlideBackground;
  /** The playing state of a background from the media list. */
  readonly media?: MediaLayer | null | undefined;
  /** The 청중 layout of the same theme, whose sizes 무대 follows. */
  readonly audience?: OwnThemeScreen | undefined;
  /** The slides of the item with this theme, for texts sized together. */
  readonly peers?: readonly SlideContent[] | undefined;
  readonly labels?: LabelPlace | undefined;
  /** The screen can not show transparent color. */
  readonly opaque?: boolean | undefined;
  readonly emptyColor: string;
  /** Prepares a paused frame without sound or animation. */
  readonly standby?: boolean | undefined;
}

export type TextElement = ThemeTextElement | ThemeNextElement;

/** A text that shows, before it is placed. */
export interface ShownText {
  readonly element: TextElement;
  readonly rows: RowsText;
}

export function isText(element: ThemeElement): element is TextElement {
  return element.kind === 'text' || element.kind === 'next';
}

/** One flowing row, for a text of more typed rows than its element takes. */
function joined(text: string, limit: number | undefined): string {
  return limit !== undefined && text.split('\n').length > limit
    ? text.replace(/\s*\n\s*/gu, ' ')
    : text;
}

/** Whether an element shows a many-row box, whose text may go on. */
function usesLongBox(
  element: ThemeTextElement,
  {boxes}: Pick<ThemeFile, 'boxes'>,
): boolean {
  const tokens = templateTokens(element.content);
  return boxes.some(box => box.rows === 'many' && tokens.has(box.name));
}

function rowsOf(
  element: TextElement,
  text: string,
  more: Partial<RowsText> = {},
): RowsText {
  return {
    text,
    style: element.style,
    width: element.frame.w,
    wrap: element.wrap ?? 'normal',
    continued: false,
    ...more,
  };
}

/** The text of one element with its color, or null when it shows nothing. */
function textOf(
  element: ThemeTextElement,
  {theme, screen, labels = 'line'}: ThemeDrawing,
  content: SlideContent,
): RowsText | null {
  const values = contentValues(theme, content);
  const text = fillTemplates(element.content, values);
  if (element.label === true && isLabelText(element)) {
    const carried = screen.elements.some(
      other =>
        other.kind === 'text' &&
        other !== element &&
        other.label === true &&
        fillTemplates(other.content, values) !== null,
    );
    return labels === 'line' && carried && text !== null
      ? rowsOf(element, text)
      : null;
  }
  if (text === null) {
    const {empty} = element;
    const instead =
      empty === undefined ? null : fillTemplates(empty.content, values);
    return empty === undefined || instead === null
      ? null
      : rowsOf(element, instead, {
          style: {...element.style, color: empty.color},
        });
  }
  const label = content.auto[AUTO_TOKENS.newLabel];
  return rowsOf(element, joined(text, element.joinRows), {
    continued: content.continued === true && usesLongBox(element, theme),
    prefix:
      element.label === true && labels === 'inline' && label !== undefined
        ? `(${label}) `
        : undefined,
  });
}

const NOTHING: SlideContent = {texts: {}, auto: {}};

/** The texts a screen shows of a slide, by their elements. */
export function shownTexts(
  drawing: ThemeDrawing,
): ReadonlyMap<string, ShownText> {
  const {screen, content, next} = drawing;
  const texts = new Map<string, ShownText>();
  for (const element of screen.elements) {
    if (!isText(element)) continue;
    let rows: RowsText | null;
    if (element.kind === 'next') {
      rows = next === null ? null : rowsOf(element, next);
    } else {
      rows =
        content === null && templateTokens(element.content).size > 0
          ? null
          : textOf(element, drawing, content ?? NOTHING);
    }
    if (rows !== null) texts.set(element.id, {element, rows});
  }
  return texts;
}

/** The texts of the other slides that an element is sized together with. */
export function peerRows(
  drawing: ThemeDrawing,
  {element}: ShownText,
): readonly RowsText[] {
  if (element.kind !== 'text' || element.fit?.together !== true) return [];
  return (drawing.peers ?? []).flatMap(
    content => textOf(element, drawing, content) ?? [],
  );
}
