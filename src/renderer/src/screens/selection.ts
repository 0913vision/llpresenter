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
  readonly lastScreenId: string | null;
  readonly select: (kind: ScreensSelectionKind, id: string) => void;
  readonly selectAfterStageRemoval: (id: string, next: string | null) => void;
  readonly stageElement: {
    readonly layoutId: string;
    readonly elementId: string;
  } | null;
  readonly selectStageElement: (
    layoutId: string,
    elementId: string | null,
  ) => void;
}

const initialSelection: ScreensSelection = {kind: 'screen', id: null};

/**
 * The one selected row across the 화면, Look, and 무대 배치 lists. Choosing a
 * row in one list clears the selection in the others.
 */
export const useScreensSelection = create<SelectionView>(set => ({
  selection: initialSelection,
  lastScreenId: null,
  select: (kind, id) =>
    set(view => ({
      selection: {kind, id},
      lastScreenId:
        kind === 'screen'
          ? id
          : view.selection.kind === 'screen'
            ? view.selection.id
            : view.lastScreenId,
    })),
  selectAfterStageRemoval: (id, next) =>
    set(view => {
      if (view.selection.kind !== 'stage' || view.selection.id !== id) {
        return view;
      }
      return {
        selection:
          next === null
            ? {kind: 'screen', id: view.lastScreenId}
            : {kind: 'stage', id: next},
        stageElement: null,
      };
    }),
  stageElement: null,
  selectStageElement: (layoutId, elementId) =>
    set({stageElement: elementId === null ? null : {layoutId, elementId}}),
}));

/** Retains the screen view while a Look or stage-layout row is selected. */
export function useScreenView(screens: readonly Screen[]): Screen | undefined {
  const id = useScreensSelection(view =>
    view.selection.kind === 'screen' ? view.selection.id : view.lastScreenId,
  );
  return selectedScreenIn({kind: 'screen', id}, screens);
}

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
