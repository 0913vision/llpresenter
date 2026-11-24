import {create} from 'zustand';
import type {AudioPlaylistId} from '@core/schema/common/ids';

/**
 * The audio playlist chosen in the 오디오 tab, which stays when the tab is left.
 */
export const useAudioSelection = create<{
  chosen: AudioPlaylistId | undefined;
  setChosen: (id: AudioPlaylistId | undefined) => void;
}>(set => ({chosen: undefined, setChosen: chosen => set({chosen})}));
