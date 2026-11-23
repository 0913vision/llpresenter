import {useEffect, useEffectEvent} from 'react';
import {createSongId, type SongId} from '@core/schema/ids';
import {undoTimeline, type UndoPlace} from '@renderer/platform/undoTimeline';
import {serviceItem} from '@renderer/session/openService';
import {openItem} from '@renderer/session/show';
import {editItemInPrep} from '../workspaces/prepPanels';

/**
 * Brings up the place of a step that 실행 취소 or 다시 실행 ran, as PowerPoint
 * goes to the slide it changed: the item with its slide in 준비, or the song
 * that came back. A media item is chosen by the media list itself.
 */
export function useUndoReveal(
  showSong: ((songId: SongId) => void) | undefined,
): void {
  const reveal = useEffectEvent((place: UndoPlace): void => {
    if (place.kind === 'song') {
      showSong?.(createSongId(place.songId));
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
