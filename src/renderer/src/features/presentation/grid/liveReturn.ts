/**
 * Where the continuous 슬라이드 view stands against the live slide, for the
 * 현 위치로 button: 'none' without a continuous view, 'here' while the live
 * slide is in sight, 'away' after the user scrolled it out of sight.
 */
export type LiveReturnState = 'none' | 'here' | 'away';

let state: LiveReturnState = 'none';
let back: (() => void) | null = null;
const listeners = new Set<() => void>();

function publish(next: LiveReturnState): void {
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
}

export const liveReturn = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: (): LiveReturnState => state,
  /** The continuous view reports whether the live slide is in sight. */
  report: (away: boolean): void => {
    if (back !== null) publish(away ? 'away' : 'here');
  },
  /** The continuous view offers its way back, or withdraws it on leaving. */
  offer: (next: (() => void) | null): void => {
    back = next;
    publish(next === null ? 'none' : 'here');
  },
  /** Brings the live slide back into the continuous view. */
  go: (): void => {
    back?.();
  },
};
