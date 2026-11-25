import {create} from 'zustand';
import type {LibrarySearchMatch} from '@core/schema/songs/librarySearch';
import type {WorkspaceTab} from '@renderer/app/useWorkspaceTabs';

/**
 * A toolbar search shown in full: Enter in the search field with no result
 * chosen shows all its matches in the center column of the tab, as a web
 * search shows its results page (USER Nov 25).
 */
export interface ShownSearch {
  readonly query: string;
  /** The tab whose center column shows the results. */
  readonly tab: WorkspaceTab;
  /** Opens a result as the search field opens it in that tab. */
  readonly open: (match: LibrarySearchMatch) => void;
  /** Whether Ctrl Enter adds a result to the 예배 순서 there. */
  readonly addsToOrder: boolean;
}

const useSearchResults = create<{readonly shown: ShownSearch | null}>(() => ({
  shown: null,
}));

/** Shows a search's results in the center column of its tab. */
export function showSearchResults(shown: ShownSearch): void {
  useSearchResults.setState({shown});
}

/** Closes the results; the center column shows what it showed before. */
export function closeSearchResults(): void {
  useSearchResults.setState({shown: null});
}

/** The search shown in `tab`, if any. */
export function useShownSearch(tab: WorkspaceTab): ShownSearch | null {
  return useSearchResults(view =>
    view.shown?.tab === tab ? view.shown : null,
  );
}
