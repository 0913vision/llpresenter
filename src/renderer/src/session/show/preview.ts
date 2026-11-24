import {create} from 'zustand';
import {STARTER_SCREEN_IDS} from '@core/screens';
import {parseScreenId} from '@core/schema/common/ids';
import type {UiState} from '@core/schema/app/uiState';

// NOTE(0913vision): The screen whose preview is large at the start. The other
// screens are small tiles.
const DEFAULT_LARGE_SCREEN_ID: string = STARTER_SCREEN_IDS.main;

interface PreviewView {
  readonly largeScreenId: string;
  readonly visible: boolean;
}

/** Which screen's 미리보기 is the large one, and whether the large one shows. */
export const usePreview = create<PreviewView>(() => ({
  largeScreenId: DEFAULT_LARGE_SCREEN_ID,
  visible: true,
}));

/** Makes a screen's preview the large one. The large one becomes small. */
export function showLarge(screenId: string): void {
  usePreview.setState({largeScreenId: screenId});
  const parsed = parseScreenId(screenId);
  if (parsed.ok) window.llp?.ui.setRememberedView({previewBig: parsed.value});
}
/** Shows or hides the large 미리보기 and remembers the choice. */
export function setPreviewVisible(visible: boolean): void {
  usePreview.setState({visible});
  window.llp?.ui.setRememberedView({previewBigVisible: visible});
}
/** Starts the 미리보기 choices from what the last session remembered. */
export function seedPreview(state: UiState): void {
  usePreview.setState({
    largeScreenId: state.previewBig ?? DEFAULT_LARGE_SCREEN_ID,
    visible: state.previewBigVisible ?? true,
  });
}
