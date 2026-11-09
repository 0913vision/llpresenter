import {limitReason} from '@core/common/limitReason';
import {MACRO_FILE_LIMITS, type MacroCollection} from '@core/schema/macros';
import {
  menuAvailability,
  type MenuEntry,
  type MenuItem,
} from '@renderer/ui/menuModel';
import {
  laterClipboardRows,
  laterRow,
  menuSeparator,
} from '@renderer/ui/menuRows';
import {
  lockedReason,
  macroActionEntries,
  type MacroActionMenuHandlers,
  type MacroActionMenuInput,
} from './macroActionMenuEntries';

/** What the 매크로 menu can ask its panel to do. */
export interface MacroMenuHandlers extends MacroActionMenuHandlers {
  readonly start?: () => void;
  readonly rename: () => void;
  readonly changeIcon: () => void;
  readonly changeColor: () => void;
  readonly toggleStartup: () => void;
  readonly addTo: (collection: MacroCollection['id']) => void;
  readonly moveTo: (collection: MacroCollection['id']) => void;
  readonly newCollection: () => void;
  readonly duplicate: () => void;
  readonly remove: () => void;
}

/** Everything the 매크로 menu shows, read from the 매크로 file. */
export interface MacroMenuInput extends MacroActionMenuInput {
  readonly collections: readonly MacroCollection[];
  /** The collection the tab shows; undefined for 모든 매크로. */
  readonly shown: MacroCollection['id'] | undefined;
  readonly macroCount: number;
}

interface CollectionRows {
  /** Collections that get a check mark and can't be picked. */
  readonly marked: (collection: MacroCollection) => boolean;
  readonly choose: (collection: MacroCollection['id']) => void;
  readonly onNew: () => void;
}

function collectionRows(
  input: MacroMenuInput,
  {marked, choose, onNew}: CollectionRows,
): readonly MenuEntry[] {
  const full = input.collections.length >= MACRO_FILE_LIMITS.collections;
  return [
    ...input.collections.map((collection): MenuItem => ({
      kind: 'item',
      id: collection.id,
      label: collection.name,
      check: 'checkbox',
      checked: marked(collection),
      ...menuAvailability(marked(collection) ? '현재 포함된 모음' : undefined),
      onSelect: () => choose(collection.id),
    })),
    ...(input.collections.length > 0 ? [menuSeparator('new-separator')] : []),
    {
      kind: 'item',
      id: 'new',
      label: '새 모음',
      ...menuAvailability(
        full ? limitReason('모음', MACRO_FILE_LIMITS.collections) : undefined,
      ),
      onSelect: onNew,
    },
  ];
}

function collectionEntries(
  input: MacroMenuInput,
  handlers: MacroMenuHandlers,
): readonly MenuEntry[] {
  const {item, shown, locked} = input;
  const holds = (collection: MacroCollection): boolean =>
    collection.macroIds.includes(item.id);
  return [
    {
      kind: 'item',
      id: 'add-to',
      contextGroup: 'library',
      label: '모음에 추가',
      ...menuAvailability(locked ? lockedReason(input) : undefined),
      submenu: collectionRows(input, {
        marked: holds,
        choose: handlers.addTo,
        onNew: handlers.newCollection,
      }),
    },
    {
      kind: 'item',
      id: 'move-to',
      contextGroup: 'library',
      label: '모음으로 옮기기',
      ...menuAvailability(
        locked
          ? lockedReason(input)
          : shown === undefined
            ? '모든 매크로에서는 옮길 수 없습니다'
            : undefined,
      ),
      submenu: collectionRows(input, {
        marked: collection => collection.id === shown,
        choose: handlers.moveTo,
        onNew: handlers.newCollection,
      }),
    },
  ];
}

function appearanceEntries(
  input: MacroMenuInput,
  handlers: MacroMenuHandlers,
): readonly MenuEntry[] {
  const {item, locked} = input;
  return [
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기',
      ...menuAvailability(locked ? lockedReason(input) : undefined),
      onSelect: handlers.rename,
    },
    {
      kind: 'item',
      id: 'color',
      label: '색 바꾸기',
      ...menuAvailability(locked ? lockedReason(input) : undefined),
      onSelect: handlers.changeColor,
    },
    {
      kind: 'item',
      id: 'icon',
      label: '아이콘 바꾸기',
      ...menuAvailability(locked ? lockedReason(input) : undefined),
      onSelect: handlers.changeIcon,
    },
    {
      kind: 'item',
      id: 'startup',
      label: '시작할 때 실행',
      check: 'checkbox',
      checked: item.runOnStartup === true,
      ...menuAvailability(locked ? lockedReason(input) : undefined),
      onSelect: handlers.toggleStartup,
    },
  ];
}

/** Why 복제 can't run on a 매크로 now, for its menu row and its key. */
export function macroDuplicateReason(
  input: Pick<MacroMenuInput, 'locked' | 'lockReason' | 'macroCount'>,
): string | undefined {
  if (input.locked) return lockedReason(input);
  return input.macroCount >= MACRO_FILE_LIMITS.macros
    ? limitReason('매크로', MACRO_FILE_LIMITS.macros)
    : undefined;
}

function clipboardEntries(
  input: MacroMenuInput,
  handlers: MacroMenuHandlers,
): readonly MenuEntry[] {
  return [
    laterRow('inspector', '속성…'),
    menuSeparator('clipboard-separator'),
    ...laterClipboardRows(),
    {
      kind: 'item',
      id: 'duplicate',
      contextGroup: 'clipboard',
      label: '복제',
      icon: 'duplicate',
      ...menuAvailability(macroDuplicateReason(input)),
      onSelect: handlers.duplicate,
    },
    menuSeparator('delete-separator'),
    {
      kind: 'item',
      id: 'delete',
      contextGroup: 'delete',
      label: '삭제',
      icon: 'trash',
      danger: true,
      ...menuAvailability(input.locked ? lockedReason(input) : undefined),
      onSelect: handlers.remove,
    },
  ];
}

/**
 * The 매크로 right-click menu, row for row as ProPresenter's (spec 11): its
 * collections, its appearance and startup, its actions, then copy and delete.
 */
export function macroMenuEntries(
  input: MacroMenuInput,
  handlers: MacroMenuHandlers,
): readonly MenuEntry[] {
  return [
    ...(handlers.start === undefined
      ? []
      : [
          {
            kind: 'item' as const,
            id: 'run',
            contextGroup: 'default' as const,
            label: '실행',
            onSelect: handlers.start,
          },
        ]),
    ...collectionEntries(input, handlers),
    menuSeparator('appearance-separator'),
    ...appearanceEntries(input, handlers),
    menuSeparator('add-separator'),
    ...macroActionEntries(input, handlers),
    menuSeparator('inspector-separator'),
    ...clipboardEntries(input, handlers),
  ];
}
