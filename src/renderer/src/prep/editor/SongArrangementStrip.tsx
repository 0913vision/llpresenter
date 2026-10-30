import {useEffect, useRef, useState, type JSX} from 'react';
import {
  arrangementGroupIds,
  isGroupedSong,
  type AnySong,
} from '@core/schema/groupedSong';
import type {Label} from '@core/schema/labels';
import {ArrangementStrip} from '@renderer/ui/LabelChip';
import {Menu} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {
  groupedOrderChips,
  legacyOrderChips,
  movedOrder,
  withoutPosition,
} from '../../features/service/items/songItemModel';
import {editedOrder, editedOrderWithLimit} from '@core/songs/songArrangements';
import type {SongSession} from './songSession';
import styles from './ArrangementRow.module.css';
import {useChipDrag} from '../../features/service/items/useChipDrag';

interface StripProps {
  readonly session: SongSession<AnySong>;
  readonly labels: readonly Label[];
  readonly locked: boolean;
}

function stripModel(session: SongSession<AnySong>, labels: readonly Label[]) {
  const {song} = session.history.snapshot;
  const name = session.arrangement;
  if (isGroupedSong(song)) {
    const order = arrangementGroupIds(song, name);
    return {
      chips: groupedOrderChips(song, order, labels),
      move: (from: number, to: number) =>
        name !== undefined &&
        session.setArrangementGroups(name, movedOrder(order, from, to)),
      remove: (index: number) =>
        name !== undefined &&
        session.setArrangementGroups(name, withoutPosition(order, index)),
      entries: song.groups.map((group, index): MenuEntry => ({
        kind: 'item',
        id: group.id,
        label: group.name || `이름표 없음 ${index + 1}`,
        swatch:
          labels.find(label => label.name === group.name)?.color ?? 'none',
        onSelect: () => {
          if (name !== undefined) {
            session.setArrangementGroups(name, [...order, group.id]);
          }
        },
      })),
    };
  }
  const order = editedOrder(song, name);
  return {
    chips: legacyOrderChips(song, order, labels),
    move: (from: number, to: number) =>
      name !== undefined &&
      session.setArrangementSlides(name, movedOrder(order, from, to)),
    remove: (index: number) =>
      name !== undefined &&
      session.setArrangementSlides(name, withoutPosition(order, index)),
    entries: song.slides.map((slide, index): MenuEntry => ({
      kind: 'item',
      id: String(index),
      label: `${index + 1} ${slide.lines[0] ?? ''}`,
      onSelect: () => {
        if (name !== undefined) {
          session.setArrangementSlides(name, [...order, index + 1]);
        }
      },
    })),
  };
}

function StripContent({
  session,
  labels,
  locked,
  capped,
}: StripProps & {readonly capped: boolean}): JSX.Element {
  const [selected, setSelected] = useState(0);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const model = capped
    ? {chips: [], entries: [], move: () => false, remove: () => false}
    : stripModel(session, labels);
  const reason = locked
    ? '변경할 수 없는 곡'
    : capped
      ? '슬라이드 수가 한도를 초과합니다'
      : session.arrangement === undefined
        ? '기본 구성은 바꿀 수 없습니다'
        : undefined;
  const drag = useChipDrag({enabled: reason === undefined, onMove: model.move});
  return (
    <>
      <div {...drag.stripProps}>
        <ArrangementStrip
          label="구성 순서"
          chips={model.chips}
          selected={selected}
          readOnlyReason={reason}
          onSelect={setSelected}
          onMove={model.move}
          onRemove={model.remove}
          onInsert={setAnchor}
          insertLabel="그룹 넣기"
          dropIndex={drag.dropIndex}
          draggingIndex={drag.draggingIndex}
        />
      </div>
      {anchor && reason === undefined ? (
        <Menu
          label="그룹 넣기"
          anchor={{kind: 'element', element: anchor}}
          entries={model.entries}
          onClose={() => setAnchor(null)}
        />
      ) : null}
    </>
  );
}

export function SongArrangementStrip(props: StripProps): JSX.Element {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    surface.current?.focus();
    surface.current?.scrollIntoView({block: 'nearest'});
  }, []);
  const capped = editedOrderWithLimit(
    props.session.history.snapshot.song,
    props.session.arrangement,
  ).capped;
  return (
    <div
      ref={surface}
      tabIndex={-1}
      role="group"
      aria-label="구성 편집"
      className={styles.strip}
    >
      <StripContent
        key={`${props.session.arrangement ?? 'default'}:${props.locked}:${capped}`}
        {...props}
        capped={capped}
      />
    </div>
  );
}
