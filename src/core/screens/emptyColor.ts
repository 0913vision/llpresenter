import type {Screen} from '../schema/screens';

/**
 * The green a 캡처용 창 screen keys out by default.
 * NOTE(0913vision): The `--chroma` token of the design system must match this
 * value; the token is for the control UI and cannot import it.
 */
export const CHROMA_KEY_COLOR = '#00B140';

/** Whether a background color is the chroma key green. */
export function isChromaKeyColor(color: string | undefined): boolean {
  return color?.toUpperCase() === CHROMA_KEY_COLOR;
}

/** The saved empty color, or the output method's default for older settings. */
export function emptyScreenColor(screen: {
  readonly method?: Screen['method'];
  readonly emptyColor?: string;
}): string {
  return (
    screen.emptyColor ??
    (screen.method === 'capture' || screen.method === 'ndi'
      ? CHROMA_KEY_COLOR
      : '#000000')
  );
}

/**
 * Whether a background is the color the output is keyed on: the chroma green
 * on any screen, or, on a 캡처용 창 screen, the screen's own key color (its
 * empty color, which the operator may set to another color for a switcher).
 */
export function isKeyBackground(
  background: string | undefined,
  screen: {readonly method?: Screen['method']; readonly emptyColor?: string},
): boolean {
  if (background === undefined) return false;
  if (isChromaKeyColor(background)) return true;
  return (
    screen.method === 'capture' &&
    background.toUpperCase() === emptyScreenColor(screen).toUpperCase()
  );
}
