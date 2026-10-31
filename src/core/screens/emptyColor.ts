import type {Screen} from '../schema/screens';

/** The saved empty color, or the output method's default for older settings. */
export function emptyScreenColor(
  screen: Pick<Screen, 'method' | 'emptyColor'>,
): string {
  return (
    screen.emptyColor ?? (screen.method === 'capture' ? '#00B140' : '#000000')
  );
}
