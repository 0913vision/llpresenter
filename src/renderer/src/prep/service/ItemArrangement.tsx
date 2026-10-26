import {useState, useSyncExternalStore, type JSX} from 'react';
import type {Label} from '@shared/schema/labels';
import {DEFAULT_ARRANGEMENT_NAME, type Song} from '@shared/schema/song';
import {editedOrder, sameOrder} from '@renderer/prep/editor/songArrangements';
import {editorTask} from '@renderer/prep/editor/editorTask';
import type {SongSession} from '@renderer/prep/editor/songSession';
import {useLive} from '@renderer/state/live';
import {ArrangementStrip} from '@renderer/ui/LabelChip';
import {Menu} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import type {ServiceItemStore} from './serviceItemStore';
import {
  movedOrder,
  orderChips,
  slideLabel,
  withoutPosition,
} from './songItemModel';
import {useChipDrag} from './useChipDrag';
import styles from './SongItemPanel.module.css';

export const DEFAULT_ORDER_REASON = '기본 구성은 변경할 수 없습니다';
export const NEWER_FILE_REASON = '새 버전의 파일이라 바꿀 수 없습니다';

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

function arrangementOptions(song: Song) {
  return [
    DEFAULT_ARRANGEMENT_NAME,
    ...(song.arrangements?.map(arrangement => arrangement.name) ?? []),
  ].map(value => ({value, label: value}));
}

export interface ItemArrangementProps {
  readonly items: ServiceItemStore;
  readonly session: SongSession;
  readonly itemId: string;
  readonly labels: readonly Label[];
  readonly selected: number | undefined;
  readonly onSelect: (index: number) => void;
}

/**
 * The 구성 row and chip strip of a song item. Picking a 구성 changes this item
 * only; chip edits change that 구성 in the song.
 */
export function ItemArrangement({
  items,
  session,
  itemId,
  labels,
  selected,
  onSelect,
}: ItemArrangementProps): JSX.Element {
  const {busy, service, arrangement} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const live = useLive(view => {
    const slide = view.state?.layers.slide;
    return slide?.itemId === itemId ? slide.position : undefined;
  });
  const [insertAnchor, setInsertAnchor] = useState<HTMLElement | null>(null);
  const {song} = session.history.snapshot;
  const order = editedOrder(song, arrangement);
  const orderReason = session.readOnly
    ? NEWER_FILE_REASON
    : arrangement === undefined
      ? DEFAULT_ORDER_REASON
      : undefined;
  const serviceReason =
    service?.access === 'readOnly' ? NEWER_FILE_REASON : undefined;
  const move = (from: number, to: number): void => {
    const next = movedOrder(order, from, to);
    if (sameOrder(next, order) || items.setOrder(next)) onSelect(to);
  };
  const drag = useChipDrag({enabled: orderReason === undefined, onMove: move});
  const insert = (number: number): void => {
    if (items.setOrder([...order, number])) onSelect(order.length);
  };
  return (
    <div className={styles.arrangement}>
      <div className={styles.choice}>
        <span className={styles.choiceLabel}>구성</span>
        <SelectMenu
          aria-label="구성"
          size="sm"
          options={arrangementOptions(song)}
          value={arrangement ?? DEFAULT_ARRANGEMENT_NAME}
          disabled={busy || serviceReason !== undefined}
          title={serviceReason}
          onChange={value =>
            editorTask(
              items.chooseArrangement(
                value === DEFAULT_ARRANGEMENT_NAME ? undefined : value,
              ),
            )
          }
          actions={[
            {
              id: 'new',
              label: '새 구성',
              icon: 'plus',
              disabled: session.readOnly,
              title: session.readOnly ? NEWER_FILE_REASON : undefined,
              onSelect: () => editorTask(items.createArrangement()),
            },
          ]}
        />
      </div>
      <div {...drag.stripProps}>
        <ArrangementStrip
          label="구성 순서"
          chips={orderChips(song, order, labels)}
          selected={selected}
          live={live}
          readOnlyReason={orderReason}
          dropIndex={drag.dropIndex}
          draggingIndex={drag.draggingIndex}
          onSelect={onSelect}
          onMove={move}
          onRemove={index => items.setOrder(withoutPosition(order, index))}
          onInsert={setInsertAnchor}
        />
      </div>
      {insertAnchor === null ? null : (
        <Menu
          label="슬라이드 넣기"
          anchor={{kind: 'element', element: insertAnchor}}
          entries={insertEntries(song, labels, insert)}
          onClose={() => setInsertAnchor(null)}
        />
      )}
    </div>
  );
}
