import {useMemo, useState, useSyncExternalStore, type JSX} from 'react';
import type {Label} from '@shared/schema/labels';
import {DEFAULT_ARRANGEMENT_NAME, type Song} from '@shared/schema/song';
import {isGroupedSong, type GroupedSong} from '@shared/schema/groupedSong';
import type {SongGroupId} from '@shared/schema/ids';
import {editedOrder} from '@renderer/prep/editor/songArrangements';
import {editorTask} from '@renderer/prep/editor/editorTask';
import type {SongSession} from '@renderer/prep/editor/songSession';
import {useLive} from '@renderer/state/live';
import {ArrangementStrip, type ArrangementChip} from '@renderer/ui/LabelChip';
import {Menu} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import type {ServiceItemStore} from './serviceItemStore';
import {
  chipIndexForSlide,
  editedGroupOrder,
  groupRangesFromGroups,
  groupedOrderChips,
  legacyOrderChips,
  movedOrder,
  sameSequence,
  slideLabel,
  withoutPosition,
} from './songItemModel';
import {useChipDrag} from './useChipDrag';
import styles from './SongItemPanel.module.css';

export const DEFAULT_ORDER_REASON = '기본 구성은 변경할 수 없습니다';
export const NEWER_FILE_REASON = '새 버전의 파일이라 바꿀 수 없습니다';
export const GROUPED_SONG_EDIT_REASON =
  '그룹 곡은 아직 라이브러리에서 편집할 수 없습니다';

interface ArrangementAdapter {
  readonly menuLabel: string;
  readonly chips: readonly ArrangementChip[];
  readonly chipSelected: (selected: number | undefined) => number | undefined;
  readonly chipLive: (live: number | undefined) => number | undefined;
  readonly selectFromChip: (chipIndex: number) => void;
  readonly move: (from: number, to: number) => void;
  readonly remove: (index: number) => void;
  readonly insertEntries: (
    labels: readonly Label[],
    onClose: () => void,
  ) => readonly MenuEntry[];
}

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
    const firstLine = group.slides[0]?.lines[0]?.trim() ?? '';
    const swatch =
      labels.find(item => item.name === group.name)?.color ?? 'none';
    return {
      kind: 'item',
      id: group.id,
      label: name,
      ...(firstLine !== '' ? {meta: firstLine} : {}),
      swatch,
      onSelect: () => onInsert(group.id),
    };
  });
}

function makeGroupedAdapter({
  song,
  arrangement,
  labels,
  items,
  sequenceLength,
  onSelect,
}: {
  readonly song: GroupedSong;
  readonly arrangement: string | undefined;
  readonly labels: readonly Label[];
  readonly items: ServiceItemStore;
  readonly sequenceLength: number;
  readonly onSelect: (index: number) => void;
}): ArrangementAdapter {
  const order = editedGroupOrder(song, arrangement);
  const ranges = groupRangesFromGroups(song, order);
  const chips = groupedOrderChips(song, order, labels);

  return {
    menuLabel: '그룹 넣기',
    chips,
    chipSelected: selected =>
      chipIndexForSlide(selected, ranges, sequenceLength),
    chipLive: live => chipIndexForSlide(live, ranges, sequenceLength),
    selectFromChip: chipIndex => {
      const target = ranges[chipIndex]?.start;
      if (target !== undefined) onSelect(target);
    },
    move: (from, to) => {
      const next = movedOrder(order, from, to);
      if (sameSequence(next, order) || items.setGroupOrder(next)) {
        const nextRanges = groupRangesFromGroups(song, next);
        const target = nextRanges[to]?.start;
        if (target !== undefined) onSelect(target);
      }
    },
    remove: index => {
      items.setGroupOrder(withoutPosition(order, index));
    },
    insertEntries: (menuLabels, onClose) =>
      groupedInsertEntries(song, menuLabels, id => {
        const next = [...order, id];
        if (items.setGroupOrder(next)) {
          const nextRanges = groupRangesFromGroups(song, next);
          const target = nextRanges[order.length]?.start;
          if (target !== undefined) onSelect(target);
        }
        onClose();
      }),
  };
}

function makeLegacyAdapter({
  song,
  arrangement,
  labels,
  items,
  onSelect,
}: {
  readonly song: Song;
  readonly arrangement: string | undefined;
  readonly labels: readonly Label[];
  readonly items: ServiceItemStore;
  readonly onSelect: (index: number) => void;
}): ArrangementAdapter {
  const order = editedOrder(song, arrangement);
  const chips = legacyOrderChips(song, order, labels);

  return {
    menuLabel: '슬라이드 넣기',
    chips,
    chipSelected: selected => selected,
    chipLive: live => live,
    selectFromChip: chipIndex => onSelect(chipIndex),
    move: (from, to) => {
      const next = movedOrder(order, from, to);
      if (sameSequence(next, order) || items.setSlideOrder(next)) {
        onSelect(to);
      }
    },
    remove: index => {
      items.setSlideOrder(withoutPosition(order, index));
    },
    insertEntries: (menuLabels, onClose) =>
      legacyInsertEntries(song, menuLabels, number => {
        if (items.setSlideOrder([...order, number])) {
          onSelect(order.length);
        }
        onClose();
      }),
  };
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
  const sequence = editedOrder(song, arrangement);
  const isGrouped = isGroupedSong(song);
  const sequenceLength = sequence.length;
  const adapter = useMemo(
    () =>
      isGrouped
        ? makeGroupedAdapter({
            song,
            arrangement,
            labels,
            items,
            sequenceLength,
            onSelect,
          })
        : makeLegacyAdapter({
            song,
            arrangement,
            labels,
            items,
            onSelect,
          }),
    [isGrouped, song, arrangement, labels, items, sequenceLength, onSelect],
  );

  const orderReason = session.readOnly
    ? NEWER_FILE_REASON
    : arrangement === undefined
      ? DEFAULT_ORDER_REASON
      : undefined;
  const serviceReason =
    service?.access === 'readOnly' ? NEWER_FILE_REASON : undefined;

  const drag = useChipDrag({
    enabled: orderReason === undefined,
    onMove: adapter.move,
  });

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
          chips={adapter.chips}
          selected={adapter.chipSelected(selected)}
          live={adapter.chipLive(live)}
          readOnlyReason={orderReason}
          dropIndex={drag.dropIndex}
          draggingIndex={drag.draggingIndex}
          onSelect={adapter.selectFromChip}
          onMove={adapter.move}
          onRemove={adapter.remove}
          onInsert={setInsertAnchor}
        />
      </div>
      {insertAnchor === null ? null : (
        <Menu
          label={adapter.menuLabel}
          anchor={{kind: 'element', element: insertAnchor}}
          entries={adapter.insertEntries(labels, () => setInsertAnchor(null))}
          onClose={() => setInsertAnchor(null)}
        />
      )}
    </div>
  );
}
