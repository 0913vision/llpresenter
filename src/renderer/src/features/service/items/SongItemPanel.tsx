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
import {ItemSongSlideGrid} from './ItemSongSlideGrid';
import type {SlidesEditorModel} from '../slides/useSlidesEditor';

/**
 * The center panel of 준비 for the item selected in the 예배 순서. It shows
 * the item the shared selection names.
 */
export function ServiceItemPanel({
  items,
  editor,
  sizeClass,
  onBack,
  slides,
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly sizeClass: SizeClass;
  readonly onBack?: (() => void) | undefined;
  readonly slides?: SlidesEditorModel | undefined;
}): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const itemId = useShow(view => view.openItemId);
  useEffect(() => {
    items.show(
      serviceId === null || itemId === null ? null : {serviceId, itemId},
    );
  }, [items, serviceId, itemId]);
  const {item, song, songStatus, position, service} = useSyncExternalStore(
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
        controller={slides}
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
  if (
    item === null ||
    !isItemOfKind(item, 'song') ||
    (song === null && songStatus !== 'missing')
  ) {
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
      onBack={onBack}
    />
  );
}

interface SongItemViewProps {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly item: ServiceItemOf<'song'>;
  readonly session: SongSession | null;
  readonly onBack?: (() => void) | undefined;
}

function SongItemView({
  items,
  editor,
  item,
  session,
  onBack,
}: SongItemViewProps): JSX.Element {
  const {service} = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const editReason =
    service?.access === 'readOnly' ? NEWER_FILE_REASON : undefined;
  return (
    <div className={styles.keys}>
      <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
        <PanelHeader>
          <PanelTitle title={session?.document.song.title ?? '없는 곡'} />
          {onBack === undefined ? (
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
          ) : null}
        </PanelHeader>
        <Button
          disabled={session === null}
          title={
            session === null ? '라이브러리 곡을 찾을 수 없습니다' : undefined
          }
          onClick={() => {
            window.llp?.window
              .openSongEditor({songId: item.song})
              .catch((error: unknown) =>
                console.error('Could not open the source song', error),
              );
          }}
        >
          {session?.document.song.title ?? '없는 곡'}
        </Button>
        <PanelBody variant="flush">
          {service === null ? null : (
            <ItemSongSlideGrid
              items={items}
              editor={editor}
              item={item}
              service={service}
              source={session}
              onBack={onBack}
            />
          )}
        </PanelBody>
        <PanelFooter count={item.slides.length} />
      </Panel>
    </div>
  );
}
