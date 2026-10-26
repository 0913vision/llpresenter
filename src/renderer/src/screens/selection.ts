import {create} from 'zustand';

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
