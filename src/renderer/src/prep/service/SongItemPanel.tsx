import {useEffect, useState, useSyncExternalStore, type JSX} from 'react';
import type {ServiceItemOf} from '@shared/schema/service';
import {isItemOfKind} from '@shared/schema/service';
import {playbackOrder} from '@shared/songOrder';
import type {SongEditorStore} from '@renderer/prep/editor';
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
import {ItemArrangement} from './ItemArrangement';
import type {ServiceItemStore} from './serviceItemStore';
import styles from './SongItemPanel.module.css';

const PANEL_LABEL = '예배 순서 항목';

/**
 * The center panel of 준비 for the item selected in the 예배 순서. It shows
 * the item the shared selection names; other kinds come in a later request.
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
    return (
      <Panel label={PANEL_LABEL} className={styles.panel}>
        <PanelHeader>{null}</PanelHeader>
      </Panel>
    );
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
  const {arrangement} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const labels =
    useSyncExternalStore(editor.subscribe, editor.getSnapshot).labels?.value
      .labels ?? [];
  const scale = useThumbnailScale(sizeClass);
  const [selected, setSelected] = useState(0);
  const {song} = session.history.snapshot;
  const sequence = playbackOrder(song, arrangement);
  const at = selected < sequence.length ? selected : sequence.length - 1;
  const shown = at < 0 ? undefined : at;
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
      <Panel label={PANEL_LABEL} className={styles.panel}>
        <PanelHeader>
          <PanelTitle
            title={session.document.song.title}
            meta={`슬라이드 ${sequence.length}개`}
          />
          <PanelActions>
            <Button icon="edit" onClick={() => editor.open(session.document)}>
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
          onSelect={setSelected}
        />
        <PanelBody variant="flush">
          <VirtualSlides
            song={song}
            numbers={sequence}
            labels={labels}
            selected={shown}
            baseline={defaultThumbnailColumns[sizeClass]}
            scale={scale}
            onSelect={setSelected}
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
