import type {LabelColor} from '@core/labels/colors';
import type {GroupedSong} from '@core/schema/groupedSong';
import type {SongGroupId} from '@core/schema/ids';
import type {Label} from '@core/schema/labels';
import {groupedOrderChips} from '@renderer/features/songs/editor/songItemModel';
import type {ArrangementChip} from '@renderer/ui/LabelChip';

/** One slide of the order, as the grid draws it. */
export interface OrderTile {
  readonly key: string;
  /** The place in the order, from 1. */
  readonly number: number;
  readonly label: string | undefined;
  readonly color: LabelColor;
  readonly text: string;
  /** The place of its group in the order row, from 0. */
  readonly chip: number;
  /** The place of the slide in the song's own order, from 0. */
  readonly block: number;
}

function colorOf(labels: readonly Label[], name: string): LabelColor {
  return labels.find(label => label.name === name)?.color ?? 'none';
}

/** The slides the order plays, one tile each, in order. */
export function orderTiles(
  song: GroupedSong,
  order: readonly SongGroupId[],
  labels: readonly Label[],
): readonly OrderTile[] {
  const groups = new Map<
    SongGroupId,
    {readonly group: GroupedSong['groups'][number]; readonly start: number}
  >();
  let start = 0;
  for (const group of song.groups) {
    groups.set(group.id, {group, start});
    start += group.slides.length;
  }
  const tiles: OrderTile[] = [];
  order.forEach((id, chip) => {
    const entry = groups.get(id);
    if (entry === undefined) return;
    const {group, start: groupStart} = entry;
    group.slides.forEach((slide, index) => {
      tiles.push({
        key: `${chip}:${index}`,
        number: tiles.length + 1,
        label: group.name === '' ? undefined : group.name,
        color: group.name === '' ? 'none' : colorOf(labels, group.name),
        text: slide.lines.join('\n'),
        chip,
        block: groupStart + index,
      });
    });
  });
  return tiles;
}

/** The 이름표 row: one chip for each group of the song, in file order. */
export function groupChoices(
  song: GroupedSong,
  labels: readonly Label[],
): readonly ArrangementChip[] {
  return groupedOrderChips(
    song,
    song.groups.map(group => group.id),
    labels,
  );
}
