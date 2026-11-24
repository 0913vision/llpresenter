import {create} from 'zustand';

/** What 준비 edits: an item of the open service, or the open library song. */
export type PrepTarget =
  {readonly kind: 'item'; readonly itemId: string} | {readonly kind: 'song'};

interface PrepTargetView {
  /** None while 준비 shows the table of the service. */
  readonly target: PrepTarget | null;
  /** Grows each time the 준비 workspace should come up. */
  readonly request: number;
}

/**
 * The editor 준비 is asked to open next, with a count that changes on every ask.
 */
export const usePrepTarget = create<PrepTargetView>(() => ({
  target: null,
  request: 0,
}));

/** Opens an editor in 준비, and 준비 itself. */
export function openInPrep(target: PrepTarget): void {
  usePrepTarget.setState(({request}) => ({target, request: request + 1}));
}

/** Goes back to the table of the service. */
export function closePrepEditor(): void {
  usePrepTarget.setState({target: null});
}
