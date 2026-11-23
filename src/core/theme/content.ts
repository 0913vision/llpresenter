import type {SlideContent} from '@core/schema/slideContent';
import type {ThemeFile} from '@core/schema/theme';
import {fillTemplates} from './template';

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
    if (own !== undefined && own !== '') return own;
    return box.default === undefined
      ? undefined
      : (fillTemplates([box.default], name => auto[name]) ?? undefined);
  };
}

/** What the slide before shows as its next text, or null for nothing. */
export function nextTextOf(
  theme: Pick<ThemeFile, 'boxes' | 'next'>,
  content: SlideContent,
): string | null {
  if (content.next !== undefined && content.next.trim() !== '') {
    return content.next;
  }
  return nextPhraseOf(theme, content);
}

/** The phrase a theme makes for the slide before, without the slide's own. */
export function nextPhraseOf(
  {boxes, next}: Pick<ThemeFile, 'boxes' | 'next'>,
  content: SlideContent,
): string | null {
  return fillTemplates(next.content, contentValues({boxes}, content));
}
