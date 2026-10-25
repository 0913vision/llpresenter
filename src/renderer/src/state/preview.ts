import {create} from 'zustand';

// NOTE(0913vision): The screen whose preview is large at the start. The other
// two are small.
const DEFAULT_LARGE_SCREEN_ID = 'main';

interface PreviewView {
  readonly largeScreenId: string;
}

export const usePreview = create<PreviewView>(() => ({
  largeScreenId: DEFAULT_LARGE_SCREEN_ID,
}));

/** Makes a screen's preview the large one. The large one becomes small. */
export function showLarge(screenId: string): void {
  usePreview.setState({largeScreenId: screenId});
}

// TODO(0913vision): Remember the large screen in `app.json` (`previewBig`)
// once the screens come from `screens.json` with their real ids (M3-D2 in
// docs/plans/m3-breakdown.md). Never save a placeholder id such as `main`:
// `previewBig` must be a screen id, so `app.json` would fail its check.
