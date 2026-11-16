import {create} from 'zustand';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {parseScreenId} from '@core/schema/ids';
import type {UiState} from '@core/schema/uiState';

// NOTE(0913vision): The screen whose preview is large at the start. The other
// screens are small tiles.
const DEFAULT_LARGE_SCREEN_ID: string = STARTER_SCREEN_IDS.main;

interface PreviewView {
  readonly largeScreenId: string;
}

export const usePreview = create<PreviewView>(() => ({
  largeScreenId: DEFAULT_LARGE_SCREEN_ID,
}));

/** Makes a screen's preview the large one. The large one becomes small. */
export function showLarge(screenId: string): void {
  usePreview.setState({largeScreenId: screenId});
  const parsed = parseScreenId(screenId);
  if (parsed.ok) window.llp?.ui.setRememberedView({previewBig: parsed.value});
}
export function seedPreview(state: UiState): void {
  usePreview.setState({
    largeScreenId: state.previewBig ?? DEFAULT_LARGE_SCREEN_ID,
  });
}
