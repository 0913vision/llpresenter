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
// when data allows it in the UI state.
