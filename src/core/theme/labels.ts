import {AUTO_TOKENS} from '@core/schema/slides/slideContent';
import type {ThemeTextElement} from '@core/schema/screens/theme';
import {templateTokens} from './template';

const LABELS: ReadonlySet<string> = new Set([
  AUTO_TOKENS.label,
  AUTO_TOKENS.newLabel,
]);

/** Whether a text shows only the label of its slide. */
export function isLabelText(element: ThemeTextElement): boolean {
  const tokens = templateTokens(element.content);
  return tokens.size === 1 && [...tokens].every(token => LABELS.has(token));
}
