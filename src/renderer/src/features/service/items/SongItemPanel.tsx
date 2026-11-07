import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useEffect, useSyncExternalStore, type JSX} from 'react';
import type {ServiceItemOf} from '@core/schema/service';
import {isItemOfKind} from '@core/schema/service';
import type {SongEditorStore} from '@renderer/features/songs/editor';
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
import {openItemSong} from './openItemSong';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {ITEM_PANEL_LABEL, OtherItemPanel} from './OtherItemPanel';
import type {ServiceItemStore} from './serviceItemStore';
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
        <ItemSlideGrid items={items} editor={editor} sizeClass={sizeClass} />
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
  const {service} = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const editReason =
    service?.access === 'readOnly' ? NEWER_FILE_REASON : undefined;
  return (
    <div className={styles.keys}>
      <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
        <PanelHeader>
          <PanelTitle title={session.document.song.title} />
          <PanelActions>
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
        <PanelBody variant="flush">
          <ItemSlideGrid items={items} editor={editor} />
        </PanelBody>
        <PanelFooter count={item.slides.length} />
      </Panel>
    </div>
  );
}
