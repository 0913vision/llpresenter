import {useMemo, useSyncExternalStore} from 'react';
import {isItemOfKind} from '@core/schema/service';
import type {MediaId} from '@core/schema/ids';
import type {LabelColor} from '@core/labels/colors';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import {useShow} from '@renderer/session/show';
import type {ServiceItemStore} from './serviceItemStore';
import {savedPassageTiles} from './bibleItemModel';
import {useItemMedia} from './useItemSources';

export interface ItemSlide {
  readonly text: string;
  readonly label: string | undefined;
  readonly color: LabelColor;
  readonly media: MediaId | undefined;
}

export function useItemSlides(
  items: ServiceItemStore,
  editor: SongEditorStore,
): readonly ItemSlide[] {
  const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const editorState = useSyncExternalStore(
    editor.subscribe,
    editor.getSnapshot,
  );
  const needsMedia = state.item !== null && isItemOfKind(state.item, 'media');
  const media = useItemMedia(editor.api.media, needsMedia);
  const bible = useShow(view =>
    savedPassageTiles(
      view,
      state.service?.service.id,
      state.item !== null && isItemOfKind(state.item, 'bible')
        ? state.item.id
        : undefined,
    ),
  );
  const {item} = state;
  return useMemo(() => {
    if (item === null) return [];
    if (isItemOfKind(item, 'song')) {
      return item.slides.map(slide => {
        return {
          text: slide.lines.join('\n'),
          label: slide.label,
          color:
            editorState.labels?.value.labels.find(
              label => label.name === slide.label,
            )?.color ?? 'none',
          media: undefined,
        };
      });
    }
    if (isItemOfKind(item, 'bible')) {
      return bible.map(tile => ({
        text: tile.lines.join('\n'),
        label: tile.label ?? undefined,
        color: tile.labelColor,
        media: undefined,
      }));
    }
    const list = media.document?.value.items ?? [];
    const byId = new Map(list.map(file => [file.id, file]));
    const ids = isItemOfKind(item, 'media') ? [item.media] : [];
    return ids.map(id => ({
      text: byId.get(id)?.name ?? '미디어 없음',
      label: undefined,
      color: 'none',
      media: id,
    }));
  }, [item, editorState.labels, media.document, bible]);
}
