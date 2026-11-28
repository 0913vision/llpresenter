import {useEffect, useEffectEvent} from 'react';
import {createSongId, type SongId} from '@core/schema/common/ids';
import {
  undoTimeline,
  type UndoPlace,
} from '@renderer/platform/undo/undoTimeline';
import {serviceItem} from '@renderer/session/service/openService';
import {openItem} from '@renderer/session/show/show';
import {editItemInPrep} from '../../workspaces/prepPanels';
import {chooseInPrepLibrary} from '@renderer/session/prepLibraryChoice';
import type {Workspace as WorkspaceId} from '@renderer/platform/WorkspaceNavigation';

/**
 * Brings back the screen a step that 실행 취소 or 다시 실행 ran was made on, as
 * PowerPoint goes to the slide it changed (USER Nov 28):
 * the item with its slide in 준비; a song deleted in 준비's 라이브러리 list chosen
 * there again, 준비 staying on screen; a song deleted in 라이브러리 open again.
 * A media item is chosen by the media list itself. Steps run in the tab on
 * screen only, so that tab is the one the step was made in.
 */
export function useUndoReveal(
  showSong: ((songId: SongId) => void) | undefined,
  tab: WorkspaceId,
): void {
  const reveal = useEffectEvent((place: UndoPlace): void => {
    if (place.kind === 'song') {
      const songId = createSongId(place.songId);
      if (tab === 'prep') chooseInPrepLibrary(songId);
      else showSong?.(songId);
      return;
    }
    if (place.kind !== 'service') return;
    const item = serviceItem(place.itemId);
    if (item === undefined) return;
    const index =
      place.slideId !== undefined && 'slides' in item
        ? item.slides.findIndex(slide => slide.id === place.slideId)
        : -1;
    if (index >= 0) editItemInPrep(item.id, index);
    else openItem(item.id);
  });
  useEffect(() => undoTimeline.onPlace(place => reveal(place)), []);
}
