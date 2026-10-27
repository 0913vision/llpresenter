import {useState, useSyncExternalStore, type JSX} from 'react';
import type {Label} from '@shared/schema/labels';
import {DEFAULT_ARRANGEMENT_NAME, type Song} from '@shared/schema/song';
import {isGroupedSong, type GroupedSong} from '@shared/schema/groupedSong';
import type {SongGroupId} from '@shared/schema/ids';
import {playbackOrder} from '@shared/songOrder';
import {editedOrder} from '@renderer/prep/editor/songArrangements';
import {editorTask} from '@renderer/prep/editor/editorTask';
import type {SongSession} from '@renderer/prep/editor/songSession';
import {useLive} from '@renderer/state/live';
import {ArrangementStrip} from '@renderer/ui/LabelChip';
import {Menu} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import type {ServiceItemStore} from './serviceItemStore';
import {
  chipIndexForSlide,
  editedGroupOrder,
  groupStartIndices,
  groupStartIndicesFromGroups,
  movedOrder,
  orderChips,
  sameSequence,
  slideLabel,
  withoutPosition,
} from './songItemModel';
import {useChipDrag} from './useChipDrag';
import styles from './SongItemPanel.module.css';

export const DEFAULT_ORDER_REASON = '기본 구성은 변경할 수 없습니다';
export const NEWER_FILE_REASON = '새 버전의 파일이라 바꿀 수 없습니다';

function legacyInsertEntries(
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

function groupedInsertEntries(
  song: GroupedSong,
  labels: readonly Label[],
  onInsert: (id: SongGroupId) => void,
): readonly MenuEntry[] {
  return song.groups.map((group, index) => {
    const position = index + 1;
    const name = group.name !== '' ? group.name : `이름표 없음 ${position}`;
    const firstLine = group.slides[0]?.lines[0] ?? '';
    const label = firstLine === '' ? name : `${name} ${firstLine}`;
    const swatch =
      labels.find(item => item.name === group.name)?.color ?? 'none';
    return {
      kind: 'item',
      id: group.id,
      label,
      swatch,
      onSelect: () => onInsert(group.id),
    };
  });
}

function arrangementOptions(song: Song | GroupedSong) {
  return [
    DEFAULT_ARRANGEMENT_NAME,
    ...(song.arrangements?.map(arrangement => arrangement.name) ?? []),
  ].map(value => ({value, label: value}));
}

export interface ItemArrangementProps {
  readonly items: ServiceItemStore;
  readonly session: SongSession | SongSession<GroupedSong>;
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
  const isGrouped = isGroupedSong(song);
  const sequence = playbackOrder(song, arrangement);
  const starts = isGrouped ? groupStartIndices(song, arrangement) : undefined;
  const groupOrder = isGrouped
    ? editedGroupOrder(song, arrangement)
    : undefined;
  const legacyOrder = !isGrouped ? editedOrder(song, arrangement) : undefined;
  const chips =
    isGrouped && groupOrder !== undefined
      ? orderChips(song, groupOrder, labels)
      : legacyOrder !== undefined
        ? orderChips(song, legacyOrder, labels)
        : [];

  const chipSelected =
    isGrouped && starts !== undefined
      ? chipIndexForSlide(selected, starts, sequence.length)
      : selected;

  const chipLive =
    isGrouped && starts !== undefined
      ? chipIndexForSlide(live, starts, sequence.length)
      : live;

  const orderReason = session.readOnly
    ? NEWER_FILE_REASON
    : arrangement === undefined
      ? DEFAULT_ORDER_REASON
      : undefined;
  const serviceReason =
    service?.access === 'readOnly' ? NEWER_FILE_REASON : undefined;

  const selectFromChip = (chipIndex: number): void => {
    if (isGrouped && starts !== undefined) {
      onSelect(starts[chipIndex] ?? 0);
    } else {
      onSelect(chipIndex);
    }
  };

  const move = (from: number, to: number): void => {
    if (isGrouped && groupOrder !== undefined) {
      const next = movedOrder(groupOrder, from, to);
      if (sameSequence(next, groupOrder) || items.setOrder(next)) {
        const nextStarts = groupStartIndicesFromGroups(song, next);
        onSelect(nextStarts[to] ?? 0);
      }
      return;
    }
    if (legacyOrder !== undefined) {
      const next = movedOrder(legacyOrder, from, to);
      if (sameSequence(next, legacyOrder) || items.setOrder(next)) onSelect(to);
    }
  };

  const drag = useChipDrag({enabled: orderReason === undefined, onMove: move});

  const insertGroup = (id: SongGroupId): void => {
    if (isGrouped && groupOrder !== undefined) {
      const next = [...groupOrder, id];
      if (items.setOrder(next)) {
        const nextStarts = groupStartIndicesFromGroups(song, next);
        onSelect(nextStarts[groupOrder.length] ?? 0);
      }
    }
  };

  const insertSlide = (number: number): void => {
    if (legacyOrder !== undefined) {
      if (items.setOrder([...legacyOrder, number]))
        onSelect(legacyOrder.length);
    }
  };

  const remove = (index: number): void => {
    if (isGrouped && groupOrder !== undefined) {
      items.setOrder(withoutPosition(groupOrder, index));
      return;
    }
    if (legacyOrder !== undefined) {
      items.setOrder(withoutPosition(legacyOrder, index));
    }
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
          chips={chips}
          selected={chipSelected}
          live={chipLive}
          readOnlyReason={orderReason}
          dropIndex={drag.dropIndex}
          draggingIndex={drag.draggingIndex}
          onSelect={selectFromChip}
          onMove={move}
          onRemove={remove}
          onInsert={setInsertAnchor}
        />
      </div>
      {insertAnchor === null ? null : (
        <Menu
          label={isGrouped ? '그룹 넣기' : '슬라이드 넣기'}
          anchor={{kind: 'element', element: insertAnchor}}
          entries={
            isGrouped
              ? groupedInsertEntries(song, labels, insertGroup)
              : legacyInsertEntries(song, labels, insertSlide)
          }
          onClose={() => setInsertAnchor(null)}
        />
      )}
    </div>
  );
}
