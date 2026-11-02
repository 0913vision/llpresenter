import type {Result} from '../common/result';
import {SONG_GROUP_LIMITS, type GroupedSong} from '../schema/groupedSong';
import type {ServiceItemId, SongGroupId, SongId} from '../schema/ids';
import {isArrangementName} from '../schema/song';
import {isItemOfKind, type Service, type ServiceItem} from '../schema/service';
import type {ServiceItemChange} from '../services/itemFieldChanges';
import {
  expandGroupSlidesWithLimit,
  playbackGroupIds,
  type ExpandedGroupSlides,
} from './songOrder';

/** The two song item fields that decide which groups play, and in what order. */
export interface SongPlay {
  readonly arrangement?: string | undefined;
  readonly customOrder?: readonly SongGroupId[] | undefined;
}

/**
 * The group ids an item plays: customOrder, else its 구성, else all groups.
 * A missing or empty 구성 plays all groups (02); an empty customOrder plays
 * none. Every reader of what plays uses this one rule.
 */
export function playedGroupIds(
  song: GroupedSong,
  play: SongPlay,
): readonly SongGroupId[] {
  if (play.customOrder === undefined) {
    return playbackGroupIds(song, play.arrangement);
  }
  const known = new Set(song.groups.map(group => group.id));
  return play.customOrder.filter(id => known.has(id));
}

/** The played slide numbers of an item, or an empty order flagged as capped. */
export function playedOrderWithLimit(
  song: GroupedSong,
  play: SongPlay,
): ExpandedGroupSlides {
  return expandGroupSlidesWithLimit(song, playedGroupIds(song, play));
}

/** Item change that sets the order, or clears it when ids is undefined. */
export function withCustomOrder(
  ids: readonly SongGroupId[] | undefined,
): ServiceItemChange {
  return item => {
    if (!isItemOfKind(item, 'song')) return null;
    if (ids === undefined) {
      if (item.customOrder === undefined) return item;
      const {customOrder: _removed, ...rest} = item;
      return rest;
    }
    return {...item, customOrder: [...ids]};
  };
}

/** Item change that picks a 구성 and drops customOrder (the picker). */
export function withArrangementChoice(
  name: string | undefined,
): ServiceItemChange {
  return item => {
    if (!isItemOfKind(item, 'song')) return null;
    const {customOrder: _removed, arrangement: _previous, ...rest} = item;
    return name === undefined ? rest : {...rest, arrangement: name};
  };
}

/** Switches a song item to another library song, keeping its other fields. */
export function withSong(
  item: ServiceItem,
  songId: SongId,
): ServiceItem | null {
  if (!isItemOfKind(item, 'song')) return null;
  return item.song === songId ? item : {...item, song: songId};
}

/** The 예배 순서 with one song item on another song, or null without that item. */
export function withServiceItemSong(
  service: Service,
  itemId: ServiceItemId,
  songId: SongId,
): Service | null {
  const index = service.order.findIndex(item => item.id === itemId);
  const item = service.order[index];
  const switched = item === undefined ? null : withSong(item, songId);
  if (switched === null) return null;
  return {
    ...service,
    order: service.order.map((entry, at) => (at === index ? switched : entry)),
  };
}

export type ArrangementFromOrderFailure =
  'name-taken' | 'too-long' | 'bad-name';

/** The 구성 edit that 구성으로 저장… sends: a new arrangement from ids. */
export function arrangementFromOrder(
  song: GroupedSong,
  name: string,
  ids: readonly SongGroupId[],
): Result<GroupedSong, ArrangementFromOrderFailure> {
  if (!isArrangementName(name)) {
    return {ok: false, error: 'bad-name'};
  }
  const arrangements = song.arrangements ?? [];
  if (arrangements.some(entry => entry.name === name)) {
    return {ok: false, error: 'name-taken'};
  }
  const total = arrangements.reduce(
    (sum, entry) => sum + entry.groups.length,
    ids.length,
  );
  if (
    arrangements.length >= SONG_GROUP_LIMITS.arrangements ||
    total > SONG_GROUP_LIMITS.occurrences
  ) {
    return {ok: false, error: 'too-long'};
  }
  return {
    ok: true,
    value: {...song, arrangements: [...arrangements, {name, groups: [...ids]}]},
  };
}
