import {useEffect, useState, useSyncExternalStore, type JSX} from 'react';
import {DEFAULT_ARRANGEMENT_NAME, type Song} from '@shared/schema/song';
import type {Label} from '@shared/schema/labels';
import type {ServiceItemOf} from '@shared/schema/service';
import {isItemOfKind} from '@shared/schema/service';
import {playbackOrder} from '@shared/songOrder';
import type {SongEditorStore} from '@renderer/prep/editor';
import {editedOrder} from '@renderer/prep/editor/songArrangements';
import type {SongSession} from '@renderer/prep/editor/songSession';
import {VirtualSlides} from '@renderer/prep/editor/VirtualSlides';
import {
  defaultThumbnailColumns,
  type SizeClass,
} from '@renderer/shell/sizeClass';
import {useLive} from '@renderer/state/live';
import {useShow} from '@renderer/state/show';
import {
  saveThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from '@renderer/state/thumbnailScale';
import {Button} from '@renderer/ui/Button';
import {ArrangementStrip} from '@renderer/ui/LabelChip';
import {Menu} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/Panel';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {ThumbnailSizeControl} from '@renderer/ui/ThumbnailSizeControl';
import {editorTask} from '@renderer/prep/editor/editorTask';
import {historyCommand} from '@renderer/prep/editor/editorKeys';
import {isComposing} from '@renderer/ui/ime';
import type {ServiceItemStore} from './serviceItemStore';
import {
  movedOrder,
  orderChips,
  slideLabel,
  withoutPosition,
} from './songItemModel';
import styles from './SongItemPanel.module.css';

const PANEL_LABEL = '예배 순서 항목';
export const DEFAULT_ORDER_REASON = '기본 구성은 변경할 수 없습니다';
export const NEWER_FILE_REASON = '새 버전의 파일이라 바꿀 수 없습니다';

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

function insertEntries(
  song: Song,
  labels: readonly Label[],
  onInsert: (number: number) => void,
): readonly MenuEntry[] {
  return song.slides.map((slide, index) => {
    const number = index + 1;
    const name = slideLabel(song, number) ?? String(number);
    const firstLine = slide.lines[0] ?? '';
    return {
      kind: 'item',
      id: String(number),
      label: firstLine === '' ? name : `${name} ${firstLine}`,
      swatch: labels.find(label => label.name === slide.label)?.color ?? 'none',
      onSelect: () => onInsert(number),
    };
  });
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
  const {
    busy,
    service,
    arrangement: name,
  } = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const labels =
    useSyncExternalStore(editor.subscribe, editor.getSnapshot).labels?.value
      .labels ?? [];
  const live = useLive(view => {
    const slide = view.state?.layers.slide;
    return slide?.itemId === item.id ? slide.position : undefined;
  });
  const scale = useThumbnailScale(sizeClass);
  const [selected, setSelected] = useState(0);
  const [insertAnchor, setInsertAnchor] = useState<HTMLElement | null>(null);
  const {song} = session.history.snapshot;
  const order = editedOrder(song, name);
  const sequence = playbackOrder(song, name);
  const at = Math.min(selected, sequence.length - 1);
  const orderReason = session.readOnly
    ? NEWER_FILE_REASON
    : name === undefined
      ? DEFAULT_ORDER_REASON
      : undefined;
  const serviceReason =
    service?.access === 'readOnly' ? NEWER_FILE_REASON : undefined;
  const options = [
    DEFAULT_ARRANGEMENT_NAME,
    ...(song.arrangements?.map(arrangement => arrangement.name) ?? []),
  ].map(value => ({value, label: value}));
  const insert = (number: number): void => {
    if (items.setOrder([...order, number])) setSelected(order.length);
  };
  return (
    <div
      className={styles.keys}
      onKeyDown={event => {
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
        <div className={styles.arrangement}>
          <div className={styles.choice}>
            <span className={styles.choiceLabel}>구성</span>
            <SelectMenu
              aria-label="구성"
              size="sm"
              options={options}
              value={name ?? DEFAULT_ARRANGEMENT_NAME}
              disabled={busy || serviceReason !== undefined}
              title={serviceReason}
              onChange={value =>
                editorTask(
                  items.chooseArrangement(
                    value === DEFAULT_ARRANGEMENT_NAME ? undefined : value,
                  ),
                )
              }
            />
          </div>
          <ArrangementStrip
            label="구성 순서"
            chips={orderChips(song, order, labels)}
            selected={at < 0 ? undefined : at}
            live={live}
            readOnlyReason={orderReason}
            onSelect={setSelected}
            onMove={(from, to) => {
              if (items.setOrder(movedOrder(order, from, to))) setSelected(to);
            }}
            onRemove={index => items.setOrder(withoutPosition(order, index))}
            onInsert={setInsertAnchor}
          />
        </div>
        <PanelBody variant="flush">
          <VirtualSlides
            song={song}
            numbers={sequence}
            labels={labels}
            selected={at < 0 ? undefined : at}
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
        {insertAnchor === null ? null : (
          <Menu
            label="슬라이드 넣기"
            anchor={{kind: 'element', element: insertAnchor}}
            entries={insertEntries(song, labels, insert)}
            onClose={() => setInsertAnchor(null)}
          />
        )}
      </Panel>
    </div>
  );
}
