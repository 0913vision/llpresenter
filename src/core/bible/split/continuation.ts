import {CONT_MARKER} from './layout';

/** Separates only an explicitly marked continuation, preserving its leading space. */
export function continuationText(
  text: string,
  continued: boolean,
): {readonly body: string; readonly marker: string} {
  if (!continued) return {body: text, marker: ''};
  const marker = text.endsWith(CONT_MARKER)
    ? CONT_MARKER
    : text === CONT_MARKER.trimStart()
      ? text
      : '';
  return {body: marker === '' ? text : text.slice(0, -marker.length), marker};
}
