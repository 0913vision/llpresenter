import {
  useEffect,
  useRef,
  useMemo,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import type {Label} from '@core/schema/labels';
import type {Song} from '@core/schema/song';
import {isGroupedSong, type GroupedSong} from '@core/schema/groupedSong';
import type {SongGroupId} from '@core/schema/ids';
import {isItemOfKind} from '@core/schema/service';
import {
  ARRANGEMENT_LIMIT_REASON,
  editedOrder,
  editedOrderWithLimit,
} from '@core/songs/songArrangements';
import {editorTask} from '@renderer/prep/editor/editorTask';
import type {SongSession} from '@renderer/prep/editor/songSession';
import {useLive} from '@renderer/platform/live';
import {ArrangementStrip, type ArrangementChip} from '@renderer/ui/LabelChip';
import {Menu} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {ArrangementPicker} from '../editor/ArrangementPicker';
import {NewArrangementDialog} from '../editor/NewArrangementDialog';
import {Icon} from '@renderer/ui/Icon';
import {Tooltip} from '@renderer/ui/Tooltip';
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
  capped,
  onSelect,
}: {
  readonly song: GroupedSong;
  readonly arrangement: string | undefined;
  readonly labels: readonly Label[];
  readonly items: ServiceItemStore;
  readonly sequenceLength: number;
  readonly capped: boolean;
  readonly onSelect: (index: number) => void;
}): ArrangementAdapter {
  const order = capped ? [] : editedGroupOrder(song, arrangement);
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

function ArrangementStripSection({
  adapter,
  selected,
  live,
  orderReason,
  drag,
  labels,
}: {
  readonly adapter: ArrangementAdapter;
  readonly selected: number | undefined;
  readonly live: number | undefined;
  readonly orderReason: string | undefined;
  readonly drag: ReturnType<typeof useChipDrag>;
  readonly labels: readonly Label[];
}): JSX.Element {
  const [insertAnchor, setInsertAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
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
          insertLabel={adapter.menuLabel}
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
    </>
  );
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
  const {busy, service, arrangement, item} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const [creating, setCreating] = useState(false);
  const [editRequest, setEditRequest] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editRequest > 0) {
      strip.current?.focus();
      strip.current?.scrollIntoView({block: 'nearest'});
    }
  }, [editRequest]);
  const live = useLive(view => {
    const slide = view.state?.layers.slide;
    return slide?.itemId === itemId ? slide.position : undefined;
  });
  const {song} = session.history.snapshot;
  const sequence = useMemo(
    () => editedOrderWithLimit(song, arrangement),
    [song, arrangement],
  );
  const isGrouped = isGroupedSong(song);
  const sequenceLength = sequence.slides.length;
  const adapter = useMemo(
    () =>
      isGrouped
        ? makeGroupedAdapter({
            song,
            arrangement,
            labels,
            items,
            sequenceLength,
            capped: sequence.capped,
            onSelect,
          })
        : makeLegacyAdapter({
            song,
            arrangement,
            labels,
            items,
            onSelect,
          }),
    [
      isGrouped,
      song,
      arrangement,
      labels,
      items,
      sequenceLength,
      sequence.capped,
      onSelect,
    ],
  );

  const orderReason = session.readOnly
    ? NEWER_FILE_REASON
    : sequence.capped
      ? ARRANGEMENT_LIMIT_REASON
      : arrangement === undefined
        ? DEFAULT_ORDER_REASON
        : undefined;
  const serviceReason =
    service?.access === 'readOnly' ? NEWER_FILE_REASON : undefined;
  const requestedArrangement =
    item !== null && isItemOfKind(item, 'song') ? item.arrangement : undefined;
  const missingReason =
    requestedArrangement !== undefined && arrangement === undefined
      ? `‘${requestedArrangement}’ 구성이 없어 기본 구성을 사용합니다`
      : undefined;

  const drag = useChipDrag({
    enabled: orderReason === undefined,
    onMove: adapter.move,
  });

  return (
    <div className={styles.arrangement}>
      <div className={styles.choice}>
        <span className={styles.choiceLabel}>구성</span>
        <ArrangementPicker
          names={song.arrangements?.map(value => value.name) ?? []}
          selected={arrangement}
          disabled={busy || serviceReason !== undefined}
          title={serviceReason ?? missingReason}
          description={missingReason}
          createReason={session.readOnly ? NEWER_FILE_REASON : undefined}
          choose={name => editorTask(items.chooseArrangement(name))}
          create={() => setCreating(true)}
          edit={() => setEditRequest(value => value + 1)}
        />
        {missingReason === undefined ? null : (
          <Tooltip text={missingReason}>
            <span
              role="img"
              aria-label={missingReason}
              className={styles.warning}
            >
              <Icon name="warning" size={14} />
            </span>
          </Tooltip>
        )}
      </div>
      {creating ? (
        <NewArrangementDialog
          names={song.arrangements?.map(value => value.name) ?? []}
          locked={busy || session.readOnly || serviceReason !== undefined}
          create={name => items.createArrangement(name)}
          onClose={() => setCreating(false)}
        />
      ) : null}
      <div ref={strip} tabIndex={-1} role="group" aria-label="구성 편집">
        <ArrangementStripSection
          key={sequence.capped ? 'capped' : 'normal'}
          adapter={adapter}
          selected={selected}
          live={live}
          orderReason={orderReason}
          drag={drag}
          labels={labels}
        />
      </div>
    </div>
  );
}
