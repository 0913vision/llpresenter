import {create} from 'zustand';
import type {Screen} from '@shared/schema/screens';

/** The list that holds the selected row of 화면 설정. */
export type ScreensSelectionKind = 'screen' | 'look' | 'stage';

export interface ScreensSelection {
  readonly kind: ScreensSelectionKind;
  /** `null` until the operator picks a row; the screen list then shows its first screen. */
  readonly id: string | null;
}

interface SelectionView {
  readonly selection: ScreensSelection;
  readonly select: (kind: ScreensSelectionKind, id: string) => void;
}

const initialSelection: ScreensSelection = {kind: 'screen', id: null};

/**
 * The one selected row across the 화면, Look, and 무대 배치 lists. Choosing a
 * row in one list clears the selection in the others.
 */
export const useScreensSelection = create<SelectionView>(set => ({
  selection: initialSelection,
  select: (kind, id) => set({selection: {kind, id}}),
}));

/** The selected id within one list, or `undefined` when another list holds it. */
export function selectedIdIn(
  selection: ScreensSelection,
  kind: ScreensSelectionKind,
): string | undefined {
  return selection.kind === kind ? (selection.id ?? undefined) : undefined;
}

/**
 * The selected screen: the one the operator picked, or the first 청중 screen
 * (else the first 무대 screen) until a pick or after the picked one is
 * removed. `undefined` while another list holds the selection or there are no
 * screens.
 */
export function selectedScreenIn(
  selection: ScreensSelection,
  screens: readonly Screen[],
): Screen | undefined {
  if (selection.kind !== 'screen') return undefined;
  return (
    screens.find(screen => screen.id === selection.id) ??
    screens.find(screen => screen.kind === 'audience') ??
    screens[0]
  );
}
