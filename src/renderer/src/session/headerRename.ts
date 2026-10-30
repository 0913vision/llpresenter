import {create} from 'zustand';

interface HeaderRenameState {
  readonly requested: string | null;
  readonly request: (itemId: string) => void;
  readonly clear: () => void;
}

/** Lets quick add ask the list to rename the header it just inserted. */
export const useHeaderRename = create<HeaderRenameState>(set => ({
  requested: null,
  request: itemId => set({requested: itemId}),
  clear: () => set({requested: null}),
}));
