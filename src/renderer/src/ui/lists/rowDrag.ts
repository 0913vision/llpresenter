export function beforeRowMidpoint(
  y: number,
  box: Pick<DOMRect, 'top' | 'height'>,
): boolean {
  return y < box.top + box.height / 2;
}
