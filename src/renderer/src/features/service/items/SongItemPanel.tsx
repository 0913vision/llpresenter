import {useEffect, useSyncExternalStore, type JSX} from 'react';
import type {ServiceItemOf} from '@core/schema/service';
import {isItemOfKind} from '@core/schema/service';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import {playedOrderWithLimit} from '@core/songs/itemOrder';
import {ARRANGEMENT_LIMIT_REASON} from '@core/songs/songArrangements';
import {StatusDot} from '@renderer/ui/StatusMarks';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {useShow} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/Panel';
import {ItemSlideGrid} from './ItemSlideGrid';
import {openItemOrder} from './openItemOrder';
import {openItemSong} from './openItemSong';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {ItemArrangement, NEWER_FILE_REASON} from './ItemArrangement';
import {ITEM_PANEL_LABEL, OtherItemPanel} from './OtherItemPanel';
import type {ServiceItemStore} from './serviceItemStore';
import {shownPosition} from '../../songs/editor/songItemModel';
import styles from './SongItemPanel.module.css';
import {BibleItemPanel} from './BibleItemPanel';
import {SlidesItemPanel} from '../slides/SlidesItemPanel';

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
  if (item !== null && isItemOfKind(item, 'slides')) {
    return (
      <SlidesItemPanel
        api={editor.api}
        items={items}
        item={item}
        openEditor={window.llp?.slidesEditor.open}
      />
    );
  }
  if (item !== null && isItemOfKind(item, 'bible') && service !== null) {
    return (
      <BibleItemPanel
        key={`${service.service.id}:${item.id}`}
        item={item}
        serviceId={service.service.id}
        position={position}
        onSelect={index => items.selectPosition(index)}
        sizeClass={sizeClass}
      >
        <ItemSlideGrid items={items} editor={editor} />
      </BibleItemPanel>
    );
  }
  if (item === null || !isItemOfKind(item, 'song') || song === null) {
    return (
      <OtherItemPanel item={item} sizeClass={sizeClass}>
        <ItemSlideGrid items={items} editor={editor} />
      </OtherItemPanel>
    );
  }
  return (
    <SongItemView
      key={item.id}
      items={items}
      editor={editor}
      item={item}
      session={song}
    />
  );
}

interface SongItemViewProps {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly item: ServiceItemOf<'song'>;
  readonly session: SongSession;
}

function SongItemView({
  items,
  editor,
  item,
  session,
}: SongItemViewProps): JSX.Element {
  const {arrangement, position} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const labels =
    useSyncExternalStore(editor.subscribe, editor.getSnapshot).labels?.value
      .labels ?? [];
  const {song} = session.history.snapshot;
  const {slides: sequence, capped} = playedOrderWithLimit(song, {
    arrangement,
    customOrder: item.customOrder,
  });
  const shown = shownPosition(position, sequence.length);
  const select = (index: number): void => items.selectPosition(index);
  const editReason = session.readOnly ? NEWER_FILE_REASON : undefined;
  return (
    <div className={styles.keys}>
      <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
        <PanelHeader>
          <PanelTitle
            title={session.document.song.title}
            meta={capped ? '슬라이드가 너무 많음' : undefined}
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
              icon="order"
              disabled={editReason !== undefined}
              title={editReason}
              onClick={() => openItemOrder({items})}
            >
              {windowCommandLabels.editOrder}
            </Button>
            <Button
              icon="edit"
              disabled={editReason !== undefined}
              title={editReason}
              onClick={() => {
                openItemSong({items, editor});
              }}
            >
              {windowCommandLabels.editSong}
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
          onEditSong={action => openItemSong({items, editor, action})}
        />
        <PanelBody variant="flush">
          <ItemSlideGrid items={items} editor={editor} />
        </PanelBody>
        <PanelFooter count={sequence.length} />
      </Panel>
    </div>
  );
}
