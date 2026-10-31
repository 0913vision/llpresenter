import {create} from 'zustand';
import type {AudioPlaylistId} from '@core/schema/ids';

export const useAudioSelection = create<{
  chosen: AudioPlaylistId | undefined;
  setChosen: (id: AudioPlaylistId | undefined) => void;
}>(set => ({chosen: undefined, setChosen: chosen => set({chosen})}));
