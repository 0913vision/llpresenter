import {randomUUID} from 'node:crypto';
import {
  createServiceItemId,
  type ServiceItemId,
  type SongId,
} from '@shared/schema/ids';
import {
  isItemOfKind,
  type ServiceItem,
  type ServiceItemOf,
} from '@shared/schema/service';
import type {Song} from '@shared/schema/song';

/** A fresh version 4 id, checked against the schema of its kind. */
export function newItemId(): ServiceItemId {
  return createServiceItemId(randomUUID());
}

/** Copies items with new ids, so a copy never shares an id with its source. */
export function copiedItems(
  items: readonly ServiceItem[],
): readonly ServiceItem[] {
  return items.map(item => ({...item, id: newItemId()}));
}

/** Includes each selected child's header and keeps the source order (05). */
export function pickedItems(
  items: readonly ServiceItem[],
  wanted: ReadonlySet<string>,
): readonly ServiceItem[] {
  const selected = new Set(wanted);
  let header: ServiceItem | undefined;
  for (const item of items) {
    if (isItemOfKind(item, 'header')) {
      header = item;
    } else if (wanted.has(item.id) && header !== undefined) {
      selected.add(header.id);
    }
  }
  return items.filter(({id}) => selected.has(id));
}

/**
 * The first title of `base`, `base 2`, `base 3`, and so on that no song has
 * (`docs/spec/05-prep.md`, "New song").
 */
export function freeTitle(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  let number = 2;
  while (taken.has(`${base} ${number}`)) {
    number++;
  }
  return `${base} ${number}`;
}

/** The song with a 구성 renamed, or `null` when it has no 구성 of that name. */
export function withRenamedArrangement(
  song: Song,
  from: string,
  to: string,
): Song | null {
  const arrangements = song.arrangements ?? [];
  if (!arrangements.some(({name}) => name === from)) {
    return null;
  }
  return {
    ...song,
    arrangements: arrangements.map(arrangement =>
      arrangement.name === from ? {...arrangement, name: to} : arrangement,
    ),
  };
}

/** The song without a 구성, or `null` when it has no 구성 of that name. */
export function withoutArrangement(song: Song, name: string): Song | null {
  const arrangements = song.arrangements ?? [];
  if (!arrangements.some(arrangement => arrangement.name === name)) {
    return null;
  }
  return {
    ...song,
    arrangements: arrangements.filter(arrangement => arrangement.name !== name),
  };
}

/**
 * The items with every pick of a song's 구성 changed: renamed to `to`, or,
 * with `to` set to `null`, removed so the item plays 기본. Answers `null` when
 * no item picks it.
 */
export function withArrangementPicks(
  items: readonly ServiceItem[],
  {songId, from, to}: ArrangementPick,
): readonly ServiceItem[] | null {
  const next = items.map(item =>
    isItemOfKind(item, 'song') &&
    item.song === songId &&
    item.arrangement === from
      ? withPick(item, to)
      : item,
  );
  return next.some((item, index) => item !== items[index]) ? next : null;
}

function withPick(item: ServiceItemOf<'song'>, to: string | null): ServiceItem {
  return to === null
    ? withoutArrangementPick(item)
    : {...item, arrangement: to};
}

export interface ArrangementPick {
  readonly songId: SongId;
  readonly from: string;
  readonly to: string | null;
}

function withoutArrangementPick(item: ServiceItemOf<'song'>): ServiceItem {
  const {arrangement: _arrangement, ...rest} = item;
  return rest;
}
