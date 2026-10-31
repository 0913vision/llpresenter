import type {Screen} from '../schema/screens';

const order = (screen: Pick<Screen, 'kind' | 'method'>): number =>
  screen.kind === 'stage' ? 1 : screen.method === 'capture' ? 2 : 0;

/** Presents audience, stage, and capture canvases in the theme editor's order. */
export function themeScreenOrder<T extends Pick<Screen, 'kind' | 'method'>>(
  screens: readonly T[],
): readonly T[] {
  return screens.toSorted((left, right) => order(left) - order(right));
}
