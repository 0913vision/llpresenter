import {create} from 'zustand';

/** What 준비 edits: an item of the open service. */
export interface PrepTarget {
  readonly kind: 'item';
  readonly itemId: string;
}

interface PrepTargetView {
  /** None while 준비 shows the table of the service. */
  readonly target: PrepTarget | null;
  /** Grows each time 준비 or 라이브러리 should come up. */
  readonly request: number;
  /** The workspace the last request asks for. */
  readonly requested: 'prep' | 'library';
}

/**
 * The editor 준비 is asked to open next, and the workspace to bring up, with a
 * count that changes on every ask.
 */
export const usePrepTarget = create<PrepTargetView>(() => ({
  target: null,
  request: 0,
  requested: 'prep',
}));

/** Opens an item's editor in 준비, and 준비 itself. */
export function openInPrep(target: PrepTarget): void {
  usePrepTarget.setState(({request}) => ({
    target,
    request: request + 1,
    requested: 'prep',
  }));
}

/** Brings up 라이브러리, where the open library song is edited. */
export function openInLibrary(): void {
  usePrepTarget.setState(({request}) => ({
    request: request + 1,
    requested: 'library',
  }));
}

/** Goes back to the table of the service. */
export function closePrepEditor(): void {
  usePrepTarget.setState({target: null});
}
