import {AUTO_TOKENS} from '@core/schema/slideContent';
import type {ThemeElement, ThemeTextElement} from '@core/schema/theme';
import {templateTokens} from './template';

const LABELS: ReadonlySet<string> = new Set([
  AUTO_TOKENS.label,
  AUTO_TOKENS.newLabel,
]);

function textsOf(
  elements: readonly ThemeElement[],
): readonly ThemeTextElement[] {
  return elements.filter(
    (element): element is ThemeTextElement => element.kind === 'text',
  );
}

/** Whether a text shows only the label of its slide. */
export function isLabelText(element: ThemeTextElement): boolean {
  const tokens = templateTokens(element.content);
  return tokens.size === 1 && [...tokens].every(token => LABELS.has(token));
}

/** The first value a text shows, past the label: 제목 for 제목 (찬송가). */
function leadingValue(element: ThemeTextElement): string | undefined {
  return [...templateTokens(element.content.slice(0, 1))].find(
    token => !LABELS.has(token),
  );
}

/**
 * The text of 청중 that a text of another screen takes its size from: the
 * one that leads with the same value, so 제목 follows 제목. A label follows
 * the text it labels.
 */
export function followedText(
  element: ThemeTextElement,
  screen: readonly ThemeElement[],
  audience: readonly ThemeElement[],
): ThemeTextElement | undefined {
  if (isLabelText(element)) {
    const labelled = textsOf(screen).find(
      text => text.label === true && !isLabelText(text),
    );
    return labelled === undefined
      ? undefined
      : followedText(labelled, screen, audience);
  }
  const value = leadingValue(element);
  if (value === undefined) return undefined;
  return textsOf(audience).find(
    text => !isLabelText(text) && leadingValue(text) === value,
  );
}
