import {create} from 'zustand';
import type {Macro} from '@shared/schema/macros';

/** The existing action palette, opened by View or for one macro. */
export const useMacroPalette = create<{
  readonly open: boolean;
  readonly target: Macro['id'] | undefined;
  readonly show: (target?: Macro['id']) => void;
  readonly close: () => void;
}>(set => ({
  open: false,
  target: undefined,
  show: target => set({open: true, target}),
  close: () => set({open: false, target: undefined}),
}));
