/**
 * A size token of the style sheet on an element, such as `--size-row-menu`,
 * in pixels; `fallback` while the token is unset or not a number.
 */
export function tokenPixels(
  style: Pick<CSSStyleDeclaration, 'getPropertyValue'>,
  token: `--${string}`,
  fallback = 0,
): number {
  return Number.parseFloat(style.getPropertyValue(token)) || fallback;
}
