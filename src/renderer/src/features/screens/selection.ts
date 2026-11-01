import {create} from 'zustand';
import type {Screen} from '@core/schema/screens';

export interface ScreensSelection {
  /** `null` until the operator picks a screen; the list then shows its first screen. */
  readonly id: string | null;
}

interface SelectionView {
  readonly selection: ScreensSelection;
  readonly select: (id: string) => void;
}

const initialSelection: ScreensSelection = {id: null};

/** The one selected screen of 화면 설정. */
export const useScreensSelection = create<SelectionView>(set => ({
  selection: initialSelection,
  select: id => set({selection: {id}}),
}));

/** The screen the selection shows; see {@link selectedScreenIn}. */
export function useScreenView(screens: readonly Screen[]): Screen | undefined {
  const selection = useScreensSelection(view => view.selection);
  return selectedScreenIn(selection, screens);
}

/**
 * The selected screen: the one the operator picked, or the first 청중 screen
 * (else the first 무대 screen) until a pick or after the picked one is
 * removed. `undefined` when there are no screens.
 */
export function selectedScreenIn(
  selection: ScreensSelection,
  screens: readonly Screen[],
): Screen | undefined {
  return (
    screens.find(screen => screen.id === selection.id) ??
    screens.find(screen => screen.kind === 'audience') ??
    screens[0]
  );
}
