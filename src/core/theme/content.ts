import type {ThemeFile} from '../schema/theme';
import {fillTemplates} from './template';

/** The values a theme can use beside the texts of its own boxes. */
export const AUTO_TOKENS = {
  label: '이름표',
  number: '번호',
  passage: '구절',
  song: '곡 제목',
  item: '항목 이름',
} as const;

export type AutoValues = Readonly<
  Partial<Record<(typeof AUTO_TOKENS)[keyof typeof AUTO_TOKENS], string>>
>;

/** The text of a slide, as its theme draws it. */
export interface SlideContent {
  /** The slide's own texts by box name. */
  readonly texts: Readonly<Record<string, string>>;
  readonly auto: AutoValues;
  /** What the slide before shows, when this slide has its own text for it. */
  readonly next?: string | undefined;
  /** The text goes on on the next slide. */
  readonly continued?: boolean;
}

/** What each value of a theme's templates is on this slide. */
export function contentValues(
  theme: Pick<ThemeFile, 'boxes'>,
  content: SlideContent,
): (token: string) => string | undefined {
  const auto: Readonly<Record<string, string | undefined>> = content.auto;
  return token => {
    const box = theme.boxes.find(entry => entry.name === token);
    if (box === undefined) return auto[token];
    const own = content.texts[token];
    if (own !== undefined && own.trim() !== '') return own;
    return box.default === undefined
      ? undefined
      : (fillTemplates([box.default], name => auto[name]) ?? undefined);
  };
}

/** What the slide before shows as its next text, or null for nothing. */
export function nextTextOf(
  theme: Pick<ThemeFile, 'boxes' | 'next'>,
  content: SlideContent,
  first: boolean,
): string | null {
  if (content.next !== undefined && content.next.trim() !== '') {
    return content.next;
  }
  return nextPhraseOf(theme, content, first);
}

/** The phrase a theme makes for the slide before, without the slide's own. */
export function nextPhraseOf(
  {boxes, next}: Pick<ThemeFile, 'boxes' | 'next'>,
  content: SlideContent,
  first: boolean,
): string | null {
  const templates =
    first && next.atStart !== undefined ? next.atStart : next.content;
  return fillTemplates(templates, contentValues({boxes}, content));
}
