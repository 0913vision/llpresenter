import type {GroupedSong} from '../schema/groupedSong';
import type {SongGroupId} from '../schema/ids';
import {
  isItemOfKind,
  type ServiceItem,
  type ServiceItemOf,
} from '../schema/service';
import type {ServiceItemChange} from '../services/itemFieldChanges';
import {remapOverlayRanges} from '../themes/overlayRanges';
import {
  playedOrderWithLimit,
  withArrangementChoice,
  withCustomOrder,
} from './itemOrder';
import {expandGroupSlidesWithLimit} from './songOrder';

interface OrderChange {
  readonly song: GroupedSong;
  readonly item: ServiceItemOf<'song'>;
  readonly next: ServiceItem;
  readonly nextGroupIds: readonly SongGroupId[];
}

function withRemappedOverlays({
  song,
  item,
  next,
  nextGroupIds,
}: OrderChange): ServiceItem {
  if (item.overlays === undefined) return next;
  const before = playedOrderWithLimit(song, item);
  const after = expandGroupSlidesWithLimit(song, nextGroupIds);
  if (before.capped || after.capped) return next;
  return {
    ...next,
    overlays: remapOverlayRanges(item.overlays, before.slides, after.slides),
  };
}

/**
 * Item change that sets this 예배's order and moves every 오버레이 range with
 * the slides it starts and ends on, in the same write. An id the song no
 * longer has stays in the stored order, after the played ids, because 02 keeps
 * it in the file.
 */
export function withOrderEdit(
  song: GroupedSong,
  ids: readonly SongGroupId[],
): ServiceItemChange {
  const known = new Set(song.groups.map(group => group.id));
  return item => {
    if (!isItemOfKind(item, 'song')) return null;
    const unknown = (item.customOrder ?? []).filter(id => !known.has(id));
    const next = withCustomOrder([...ids, ...unknown])(item);
    return next === null
      ? null
      : withRemappedOverlays({song, item, next, nextGroupIds: ids});
  };
}

/**
 * Item change that picks a 구성 (or 기본 with undefined), drops the custom
 * order, and moves the 오버레이 ranges to the new order.
 */
export function withArrangementPick(
  song: GroupedSong,
  name: string | undefined,
): ServiceItemChange {
  const pick = withArrangementChoice(name);
  return item => {
    if (!isItemOfKind(item, 'song')) return null;
    const next = pick(item);
    if (next === null) return null;
    // NOTE(0913vision): An empty named 구성 plays all groups on the output
    // (playbackGroupIds) but none in playedOrderWithLimit, so the ranges of an
    // item that picks an empty 구성 can disagree with what plays.
    const nextIds =
      song.arrangements?.find(entry => entry.name === name)?.groups ??
      song.groups.map(group => group.id);
    return withRemappedOverlays({song, item, next, nextGroupIds: nextIds});
  };
}
