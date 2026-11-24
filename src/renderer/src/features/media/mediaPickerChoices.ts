import type {MediaItem} from '@core/schema/media/mediaList';
import {mediaName} from './mediaEntries';

export const NONE_LABEL = '없음';

/** A file to choose, or a fill that is painted instead of a file. */
export interface MediaPickerItem {
  readonly id: string;
  readonly name: string;
  readonly kind: MediaItem['kind'] | 'fill';
  readonly internal?: boolean | undefined;
  readonly paint?: string | undefined;
}

/** A row of the picker: the default (undefined), 없음 (null), or an item. */
export type PickerChoice = MediaPickerItem | null | undefined;

/** The rows above the items: the default, and 없음 when it is a choice of its own. */
export interface PickerSpecials {
  readonly defaultChoice?:
    {readonly label: string; readonly detail: string} | undefined;
  /** Whether the default row is there without `defaultChoice`, as 없음. */
  readonly allowNone: boolean;
  readonly explicitNone?: {readonly selected: boolean} | undefined;
}

/** A name as the search compares it. */
export function searchName(value: string): string {
  return value.trim().normalize('NFC').toLocaleLowerCase();
}

/** Whether row `choice` is the one chosen now. */
export function isChosenChoice(
  choice: PickerChoice,
  selected: string | undefined,
  specials: PickerSpecials,
): boolean {
  if (choice === null) return specials.explicitNone?.selected === true;
  if (choice === undefined) {
    return selected === undefined && specials.explicitNone?.selected !== true;
  }
  return choice.id === selected;
}

/** The name a row shows. */
export function choiceLabel(
  choice: PickerChoice,
  specials: PickerSpecials,
): string {
  if (choice === null) return NONE_LABEL;
  if (choice === undefined) return specials.defaultChoice?.label ?? NONE_LABEL;
  return mediaName(choice);
}

/**
 * The rows the picker lists for `query`: the special rows first, then the
 * items whose names hold it, the leading group's before the rest, and the
 * group headings with the row each one stands above.
 */
export function pickerChoices({
  items,
  leadingGroup,
  itemsLabel,
  query,
  specials,
}: {
  readonly items: readonly MediaPickerItem[];
  readonly leadingGroup?:
    | {readonly label: string; readonly items: readonly MediaPickerItem[]}
    | undefined;
  readonly itemsLabel?: string | undefined;
  readonly query: string;
  readonly specials: PickerSpecials;
}) {
  const hasDefault = specials.allowNone || specials.defaultChoice !== undefined;
  const specialCount =
    (hasDefault ? 1 : 0) + (specials.explicitNone === undefined ? 0 : 1);
  const term = searchName(query);
  const matches = [...(leadingGroup?.items ?? []), ...items].filter(
    item =>
      item.kind !== 'audio' &&
      item.internal !== true &&
      searchName(mediaName(item)).includes(term),
  );
  const choices: readonly PickerChoice[] = [
    ...(hasDefault ? [undefined] : []),
    ...(specials.explicitNone === undefined ? [] : [null]),
    ...matches,
  ];
  const leadingIds = new Set(leadingGroup?.items.map(item => item.id));
  const leadingCount = matches.filter(item => leadingIds.has(item.id)).length;
  const groups = [
    ...(leadingGroup !== undefined && leadingCount > 0
      ? [{index: specialCount, label: leadingGroup.label}]
      : []),
    ...(itemsLabel !== undefined && matches.length > leadingCount
      ? [{index: specialCount + leadingCount, label: itemsLabel}]
      : []),
  ];
  return {
    choices,
    groups,
    specialCount,
    hasDefault,
    /** Whether the search finds any item, so the first item takes the focus. */
    found: term !== '' && matches.length > 0,
  };
}

/**
 * Where row `index` of the picker starts, in pixels: the rows above it, the
 * divider under the special choices, and the group headings above it.
 */
export function pickerRowTop(
  index: number,
  {
    row,
    gap,
    specialCount,
    groups,
  }: {
    readonly row: number;
    readonly gap: number;
    readonly specialCount: number;
    readonly groups: ReadonlyArray<{readonly index: number}>;
  },
): number {
  return (
    index * row +
    (index >= specialCount ? gap : 0) +
    groups.filter(group => group.index <= index).length * row
  );
}
