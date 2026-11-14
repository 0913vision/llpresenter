import {cardOffset} from '@core/services/sectionCards';
import {sectionCardEntries} from './sectionCardActions';
import {useEffect, useSyncExternalStore, type JSX} from 'react';
import {createSongId} from '@core/schema/ids';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import type {ServiceItemOf} from '@core/schema/service';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import {
  itemSongDocument,
  itemSongContent,
  loadItemSong,
} from '@renderer/features/songs/editor/itemSongSession';
import {SongSlideSurface} from '@renderer/features/songs/editor/SongSlideSurface';
import {VirtualSlides} from '@renderer/features/songs/editor/VirtualSlides';
import {useThumbnailScale} from '@renderer/platform/thumbnailScale';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import type {ServiceItemStore} from './serviceItemStore';
import {openItemSong} from './openItemSong';
import {OverlayClips} from './OverlayClip';
import {useOverlayControl} from './useOverlayControl';
import {useOverlayEditing} from './useOverlayEditing';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useShow} from '@renderer/session/show';
import styles from '../../songs/editor/SongPanels.module.css';

/** The table grid borrows the very same private item session as the inline editor. */
export function ItemSongSlideGrid({
  items,
  editor,
  item,
  service,
  source,
  onBack,
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly item: ServiceItemOf<'song'>;
  readonly service: ServiceDocument;
  readonly source: SongSession | null;
  readonly onBack?: (() => void) | undefined;
}): JSX.Element | null {
  useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  useEffect(() => {
    editor.showItemSong(createSongId(item.id));
    return () => editor.showItemSong(null);
  }, [editor, item.id]);
  useEffect(() => {
    const api = items.api;
    const target = {serviceId: service.service.id, itemId: item.id};
    const document = itemSongDocument(
      service,
      target,
      source?.document.song ?? {
        format: 'llsong',
        schemaVersion: 1,
        id: item.song,
        title: '없는 곡',
        slides: [],
      },
    );
    if (document === null) return;
    editor.attach(document, {
      content: itemSongContent(api, target, item.song),
      reload: () => loadItemSong(api, target, item.song),
    });
  }, [editor, items.api, item.id, item.song, service, source?.document.song]);
  const session = editor.sessionOf(createSongId(item.id));
  return session === undefined ? null : (
    <ItemSongTiles
      items={items}
      editor={editor}
      session={session}
      item={item}
      onBack={onBack}
    />
  );
}

function ItemSongTiles({
  items,
  editor,
  session,
  item,
  onBack,
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly session: SongSession;
  readonly item: ServiceItemOf<'song'>;
  readonly onBack?: (() => void) | undefined;
}): JSX.Element {
  const view = useSyncExternalStore(
    session.history.model.subscribe,
    session.history.model.getSnapshot,
  );
  const state = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const scale = useThumbnailScale('normal');
  const row = useShow(view => {
    const row = view.rows.find(row => row.id === item.id);
    return row?.kind === 'song' ? row : undefined;
  });
  const theme = useSlideTheme(
    row ?? {
      id: item.id,
      kind: 'song',
      title: session.title.value,
      ...(item.theme === undefined ? {} : {theme: item.theme}),
    },
  );
  const at = session.selectedOccurrence;
  const offset = cardOffset(item);
  const {editing} = useOverlayEditing({
    api: editor.api,
    item: {...item, slides: view.slides},
    count: view.slides.length,
    reason: session.readOnly ? NEWER_FILE_REASON : undefined,
    change: change => items.changeOverlays(change),
  });
  const overlay = useOverlayControl(editing);
  useEffect(() => items.selectPosition(at + offset), [items, at, offset]);
  return (
    <SongSlideSurface
      session={session}
      onBack={onBack}
      store={editor}
      onEdit={index => openItemSong({items, editor, position: index})}
      onHotKey={index =>
        openItemSong({items, editor, position: index, action: 'hot-key'})
      }
      className={styles.slideSurface}
      extraMenu={index => [
        ...sectionCardEntries(items),
        ...overlay.entries(index + 1),
      ]}
    >
      <VirtualSlides
        session={session}
        song={session.history.snapshot.song}
        numbers={view.slides.map((_, index) => index + (1 + cardOffset(item)))}
        labels={state.labels?.value.labels ?? []}
        selected={at}
        baseline={2}
        scale={scale}
        onSelect={index => session.selectOccurrence(index)}
        onEdit={index => openItemSong({items, editor, position: index})}
        decoration={start => (
          <OverlayClips control={overlay} positionOffset={start} />
        )}
        canvasFor={index => {
          const slide = view.slides[index];
          return slide === undefined || theme === undefined ? undefined : (
            <SlidePicture
              output
              {...theme}
              background={theme.background ?? session.background}
              slide={{
                itemId: item.id,
                position: index,
                label: slide.label ?? null,
                lines: slide.lines,
                ...(slide.titleSlide === undefined
                  ? {}
                  : {titleSlide: slide.titleSlide}),
                ...(slide.titleLayout === undefined
                  ? {}
                  : {titleLayout: slide.titleLayout}),
                ...(slide.lyricFormat === undefined
                  ? {}
                  : {lyricFormat: slide.lyricFormat}),
              }}
            />
          );
        }}
      />
    </SongSlideSurface>
  );
}
