import {useEffect, useSyncExternalStore, type JSX} from 'react';
import type {ServiceItemOf} from '@shared/schema/service';
import {isItemOfKind} from '@shared/schema/service';
import {isGroupedSong, type GroupedSong} from '@shared/schema/groupedSong';
import {playbackOrder} from '@shared/songOrder';
import type {SongEditorStore} from '@renderer/prep/editor';
import {editedOrder} from '@renderer/prep/editor/songArrangements';
import type {SongSession} from '@renderer/prep/editor/songSession';
import {VirtualSlides} from '@renderer/prep/editor/VirtualSlides';
import {
  defaultThumbnailColumns,
  type SizeClass,
} from '@renderer/shell/sizeClass';
import {useShow} from '@renderer/state/show';
import {
  saveThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from '@renderer/state/thumbnailScale';
import {Button} from '@renderer/ui/Button';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/Panel';
import {ThumbnailSizeControl} from '@renderer/ui/ThumbnailSizeControl';
import {historyCommand} from '@renderer/prep/editor/editorKeys';
import {isComposing} from '@renderer/ui/ime';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {
  GROUPED_SONG_EDIT_REASON,
  ItemArrangement,
  NEWER_FILE_REASON,
} from './ItemArrangement';
import {ITEM_PANEL_LABEL, OtherItemPanel} from './OtherItemPanel';
import type {ServiceItemStore} from './serviceItemStore';
import {isV1SongDocument, shownPosition} from './songItemModel';
import styles from './SongItemPanel.module.css';

/**
 * The center panel of 준비 for the item selected in the 예배 순서. It shows
 * the item the shared selection names.
 */
export function ServiceItemPanel({
  items,
  editor,
  sizeClass,
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly sizeClass: SizeClass;
}): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const itemId = useShow(view => view.openItemId);
  useEffect(() => {
    items.show(
      serviceId === null || itemId === null ? null : {serviceId, itemId},
    );
  }, [items, serviceId, itemId]);
  const {item, song} = useSyncExternalStore(items.subscribe, items.getSnapshot);
  if (item === null || !isItemOfKind(item, 'song') || song === null) {
    return <OtherItemPanel item={item} sizeClass={sizeClass} />;
  }
  return (
    <SongItemView
      key={item.id}
      items={items}
      editor={editor}
      item={item}
      session={song}
      sizeClass={sizeClass}
    />
  );
}

interface SongItemViewProps {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly item: ServiceItemOf<'song'>;
  readonly session: SongSession | SongSession<GroupedSong>;
  readonly sizeClass: SizeClass;
}

function SongItemView({
  items,
  editor,
  item,
  session,
  sizeClass,
}: SongItemViewProps): JSX.Element {
  const {arrangement, position} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const labels =
    useSyncExternalStore(editor.subscribe, editor.getSnapshot).labels?.value
      .labels ?? [];
  const scale = useThumbnailScale(sizeClass);
  const {song} = session.history.snapshot;
  const sequence = isGroupedSong(song)
    ? editedOrder(song, arrangement)
    : playbackOrder(song, arrangement);
  const shown = shownPosition(position, sequence.length);
  const select = (index: number): void => items.selectPosition(index);
  // TODO(0913vision): Remove the guard and enable library edit in group-7.
  const editReason = !isV1SongDocument(session.document)
    ? GROUPED_SONG_EDIT_REASON
    : session.readOnly
      ? NEWER_FILE_REASON
      : undefined;
  return (
    <div
      className={styles.keys}
      onKeyDown={event => {
        if (event.defaultPrevented || isInTextEntry(event.target)) return;
        const command = historyCommand(event);
        if (command === undefined || isComposing(event)) return;
        event.preventDefault();
        session.edit(command);
      }}
    >
      <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
        <PanelHeader>
          <PanelTitle
            title={session.document.song.title}
            meta={`슬라이드 ${sequence.length}개`}
          />
          <PanelActions>
            <Button
              icon="edit"
              disabled={editReason !== undefined}
              title={editReason}
              onClick={() => {
                if (isV1SongDocument(session.document)) {
                  editor.open(session.document);
                }
              }}
            >
              라이브러리 곡 편집
            </Button>
          </PanelActions>
        </PanelHeader>
        <ItemArrangement
          items={items}
          session={session}
          itemId={item.id}
          labels={labels}
          selected={shown}
          onSelect={select}
        />
        <PanelBody variant="flush">
          <VirtualSlides
            song={song}
            numbers={sequence}
            labels={labels}
            selected={shown}
            baseline={defaultThumbnailColumns[sizeClass]}
            scale={scale}
            onSelect={select}
          />
        </PanelBody>
        <PanelFooter
          end={
            <ThumbnailSizeControl
              value={scale}
              onChange={value => showThumbnailScale(sizeClass, value)}
              onCommit={value => saveThumbnailScale(sizeClass, value)}
            />
          }
        />
      </Panel>
    </div>
  );
}
