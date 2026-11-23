import {useEffect, useRef, useState} from 'react';

/** The fewest and most grid columns the size slider sets. */
export const MIN_MEDIA_COLUMNS = 2;
export const MAX_MEDIA_COLUMNS = 8;
export const DEFAULT_MEDIA_COLUMNS = 5;

export type MediaDisplay = 'grid' | 'list';

/**
 * The grid or list and the columns of the media view, kept in the UI state.
 * A choice made before the saved one is read wins over it.
 */
export function useMediaLayout() {
  const [columns, setColumns] = useState<number>();
  const [display, setDisplay] = useState<MediaDisplay>('grid');
  const displayChanged = useRef(false);
  const columnsChanged = useRef(false);
  useEffect(() => {
    let active = true;
    window.llp?.ui
      .get()
      .then(state => {
        if (!active) return;
        const saved = state.mediaBrowser;
        if (!displayChanged.current && saved?.view !== undefined) {
          setDisplay(saved.view);
        }
        if (!columnsChanged.current && saved?.columns !== undefined) {
          setColumns(saved.columns);
        }
      })
      .catch((error: unknown) =>
        console.error('Could not read media view size', error),
      );
    return () => {
      active = false;
    };
  }, []);
  return {
    display,
    /** Undefined while the grid fits its height on its own. */
    columns,
    changeDisplay: (next: MediaDisplay): void => {
      displayChanged.current = true;
      setDisplay(next);
      window.llp?.ui.setMediaBrowser({view: next});
    },
    changeColumns: (next: number): void => {
      columnsChanged.current = true;
      setColumns(next);
      window.llp?.ui.setMediaBrowser({columns: next});
    },
  };
}
