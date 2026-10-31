import {
  isItemOfKind,
  type ServiceItem,
  type ServiceItemOf,
} from '../schema/service';
import type {GroupedSong} from '../schema/groupedSong';
import type {Song} from '../schema/song';
/**
 * Returns the changed item, the same item when nothing changes, or `null`
 * when the item can't take the change, such as a header asked for a 구성.
 */
export type ServiceItemChange = (item: ServiceItem) => ServiceItem | null;

const startKinds = ['song', 'bible', 'media', 'notice'] as const;
/** Item kinds that carry start actions, memos and appearance overrides. */
export type StartItem = ServiceItemOf<(typeof startKinds)[number]>;
type StartField = 'macro' | 'memo';

/** The items that run a start 매크로 and keep a memo (spec 02). */
export function isStartItem(item: ServiceItem): item is StartItem {
  return startKinds.some(kind => isItemOfKind(item, kind));
}

function setStartField(
  item: StartItem,
  field: StartField,
  value: string | undefined,
): StartItem {
  const updated = {...item};
  switch (field) {
    case 'macro':
      if (value === undefined) delete updated.macro;
      else updated.macro = value;
      break;
    case 'memo':
      if (value === undefined) delete updated.memo;
      else updated.memo = value;
      break;
  }
  return updated;
}

/** Changes one supported start field, retaining identity for an unchanged value. */
export function withStartField(
  field: StartField,
  value: string | undefined,
): ServiceItemChange {
  return item => {
    if (!isStartItem(item)) return null;
    return item[field] === value ? item : setStartField(item, field, value);
  };
}

/** Falls back to 기본 when the item or its named arrangement is unavailable. */
export function effectiveArrangement(
  item: ServiceItem | null,
  song: Song | GroupedSong | undefined,
): string | undefined {
  if (item === null || !isItemOfKind(item, 'song') || song === undefined) {
    return undefined;
  }
  return song.arrangements?.some(entry => entry.name === item.arrangement) ===
    true
    ? item.arrangement
    : undefined;
}
