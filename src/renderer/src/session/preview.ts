import {create} from 'zustand';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';

// NOTE(0913vision): The screen whose preview is large at the start. The other
// screens are small tiles.
const DEFAULT_LARGE_SCREEN_ID: string = STARTER_SCREEN_IDS.main;

interface PreviewView {
  readonly largeScreenId: string;
  /** The panel has no room for the tile row; its header offers a picker instead. */
  readonly tilesHidden: boolean;
}

export const usePreview = create<PreviewView>(() => ({
  largeScreenId: DEFAULT_LARGE_SCREEN_ID,
  tilesHidden: false,
}));

/** Tells the header whether the 진행 panel shows its tile row. */
export function setTilesHidden(hidden: boolean): void {
  if (usePreview.getState().tilesHidden !== hidden) {
    usePreview.setState({tilesHidden: hidden});
  }
}

/** Makes a screen's preview the large one. The large one becomes small. */
export function showLarge(screenId: string): void {
  usePreview.setState({largeScreenId: screenId});
}

// TODO(0913vision): Remember the large screen in `app.json` (`previewBig`)
// once the screens come from `screens.json` with their real ids (M3-D2 in
// docs/plans/m3-breakdown.md). Never save a placeholder id such as `main`:
// `previewBig` must be a screen id, so `app.json` would fail its check.
