import {useEffect, useSyncExternalStore, type JSX} from 'react';
import type {ServiceItemOf} from '@core/schema/service';
import {isItemOfKind} from '@core/schema/service';
import {isGroupedSong} from '@core/schema/groupedSong';
import {playbackOrder} from '@core/songs/songOrder';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import {
  ARRANGEMENT_LIMIT_REASON,
  editedOrderWithLimit,
} from '@core/songs/songArrangements';
import {StatusDot} from '@renderer/ui/StatusMarks';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import {VirtualSlides} from '@renderer/features/songs/editor/VirtualSlides';
import {defaultThumbnailColumns, type SizeClass} from '@renderer/ui/sizeClass';
import {useShow} from '@renderer/session/show';
import {
  saveThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from '@renderer/platform/thumbnailScale';
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
import {historyCommand} from '@renderer/features/songs/editor/editorKeys';
import {isComposing} from '@renderer/ui/ime';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {ItemArrangement, NEWER_FILE_REASON} from './ItemArrangement';
import {ITEM_PANEL_LABEL, OtherItemPanel} from './OtherItemPanel';
import type {ServiceItemStore} from './serviceItemStore';
import {shownPosition} from '../../songs/editor/songItemModel';
import styles from './SongItemPanel.module.css';
import {BibleItemPanel} from './BibleItemPanel';

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
  const {item, song, position, service} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  if (item !== null && isItemOfKind(item, 'bible') && service !== null) {
    return (
      <BibleItemPanel
        key={`${service.service.id}:${item.id}`}
        item={item}
        serviceId={service.service.id}
        position={position}
        onSelect={index => items.selectPosition(index)}
        sizeClass={sizeClass}
      />
    );
  }
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
  readonly session: SongSession;
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
  const {slides: sequence, capped} = isGroupedSong(song)
    ? editedOrderWithLimit(song, arrangement)
    : {slides: playbackOrder(song, arrangement), capped: false};
  const shown = shownPosition(position, sequence.length);
  const select = (index: number): void => items.selectPosition(index);
  const editReason = session.readOnly ? NEWER_FILE_REASON : undefined;
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
            meta={capped ? '한도 초과' : `슬라이드 ${sequence.length}개`}
          />
          <PanelActions>
            {capped ? (
              <span
                role="status"
                aria-label={ARRANGEMENT_LIMIT_REASON}
                title={ARRANGEMENT_LIMIT_REASON}
              >
                <StatusDot tone="warning" />
              </span>
            ) : null}
            <Button
              icon="edit"
              disabled={editReason !== undefined}
              title={editReason}
              onClick={() => {
                editor.open(session.document);
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
