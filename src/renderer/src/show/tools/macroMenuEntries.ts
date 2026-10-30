import {paletteColors, type PaletteColor} from '@shared/colors';
import {
  MACRO_FILE_LIMITS,
  isKnownMacroAction,
  type Macro,
  type MacroAction,
  type MacroActionKind,
  type MacroCollection,
} from '@shared/schema/macros';
import {labelColorNames} from '@renderer/ui/LabelColorPicker';
import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
import type {MacroTargetChoice} from './macroTargets';
import {
  laterClipboardRows,
  laterRow,
  menuSeparator,
} from '@renderer/ui/menuRows';

/** What the 매크로 menu can ask its panel to do. */
export interface MacroMenuHandlers {
  readonly rename: () => void;
  readonly changeIcon: () => void;
  readonly changeColor: (color: PaletteColor) => void;
  readonly toggleStartup: () => void;
  readonly addTo: (collection: MacroCollection['id']) => void;
  readonly moveTo: (collection: MacroCollection['id']) => void;
  readonly newCollection: () => void;
  readonly addAction: (kind: MacroActionKind) => void;
  readonly openPalette: () => void;
  readonly editAction: (index: number) => void;
  readonly removeAction: (index: number) => void;
  readonly duplicate: () => void;
  readonly remove: () => void;
}

/** Everything the 매크로 menu shows, read from the 매크로 file. */
export interface MacroMenuInput {
  readonly item: Macro;
  readonly collections: readonly MacroCollection[];
  /** The collection the tab shows; undefined for 모든 매크로. */
  readonly shown: MacroCollection['id'] | undefined;
  readonly macroCount: number;
  readonly locked: boolean;
  /** Target names by action kind; undefined while they load. */
  readonly targets:
    | Partial<Readonly<Record<MacroActionKind, readonly MacroTargetChoice[]>>>
    | undefined;
}

interface ActionKindRow {
  readonly kind: MacroActionKind;
  readonly label: string;
  readonly icon: string;
}

/** The kinds a 매크로 can run, with their names and icons. */
export const ACTION_KINDS: Readonly<Record<MacroActionKind, ActionKindRow>> = {
  clearAll: {kind: 'clearAll', label: '모두 지우기', icon: 'eraser'},
  clearLayer: {kind: 'clearLayer', label: '레이어 지우기', icon: 'eraser'},
  look: {kind: 'look', label: 'Look 바꾸기', icon: 'layers'},
  stageLayout: {kind: 'stageLayout', label: '무대 화면 배치', icon: 'monitor'},
  timer: {kind: 'timer', label: '타이머', icon: 'timer'},
  prop: {kind: 'prop', label: '소품', icon: 'prop'},
  message: {kind: 'message', label: '메시지', icon: 'msg'},
  notice: {kind: 'notice', label: '공지', icon: 'notice'},
  media: {kind: 'media', label: '배경 미디어', icon: 'image'},
  audio: {kind: 'audio', label: '오디오', icon: 'audio'},
  audioPlaylist: {
    kind: 'audioPlaylist',
    label: '오디오 재생 목록',
    icon: 'wave',
  },
  macro: {kind: 'macro', label: '매크로', icon: 'macro'},
};

/** ProPresenter's Add Action rows we don't have yet, by name and icon. */
const LATER_KINDS = {
  slideDestination: {label: '슬라이드 출력 대상', icon: 'slides'},
  communication: {label: '외부 장치 신호', icon: 'plugs'},
  audioInput: {label: '오디오 입력', icon: 'mic'},
  videoInput: {label: '비디오 입력', icon: 'film'},
  capture: {label: '녹화와 방송', icon: 'capture'},
} as const;

const separator = menuSeparator;

function later(id: string, label: string, icon?: string): MenuItem {
  return laterRow(id, label, {icon});
}

function targetId(action: MacroAction): string | undefined {
  if (!isKnownMacroAction(action)) return undefined;
  switch (action.kind) {
    case 'look':
      return action.look;
    case 'stageLayout':
      return action.layout;
    case 'clearAll':
      return undefined;
    case 'clearLayer':
      return 'prop' in action ? action.prop : action.layer;
    case 'media':
      return action.media;
    case 'prop':
      return action.prop;
    case 'message':
      return action.template;
    case 'notice':
      return action.notice;
    case 'audio':
      return action.operation === 'play' ? action.media : undefined;
    case 'audioPlaylist':
      return action.playlist;
    case 'timer':
      return action.timer;
    case 'macro':
      return action.macro;
  }
}

/**
 * The name a row gives an action: its target ("찬양" for a Look action), or
 * the kind when the action has no target or the targets are still loading.
 */
export function macroActionName(
  action: MacroAction,
  targets: MacroMenuInput['targets'],
): string {
  if (!isKnownMacroAction(action)) return '알 수 없는 동작';
  const kind = ACTION_KINDS[action.kind];
  if (action.kind === 'audio' && action.operation !== 'play') {
    return action.operation === 'stop' ? '오디오 멈춤' : '오디오 페이드 아웃';
  }
  const id = targetId(action);
  const name = targets?.[action.kind]?.find(choice => choice.id === id)?.name;
  if (name === undefined) return kind.label;
  return action.kind === 'clearLayer' ? `${name} 지우기` : name;
}

function actionIcon(action: MacroAction): string | undefined {
  return isKnownMacroAction(action)
    ? ACTION_KINDS[action.kind].icon
    : undefined;
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
      disabled: marked(collection),
      onSelect: () => choose(collection.id),
    })),
    ...(input.collections.length > 0 ? [separator('new-separator')] : []),
    {
      kind: 'item',
      id: 'new',
      label: '새 모음',
      disabled: full,
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
      label: '모음에 추가',
      disabled: locked,
      submenu: collectionRows(input, {
        marked: holds,
        choose: handlers.addTo,
        onNew: handlers.newCollection,
      }),
    },
    {
      kind: 'item',
      id: 'move-to',
      label: '모음으로 옮기기',
      disabled: locked || shown === undefined,
      title:
        shown === undefined ? '모든 매크로에서는 옮길 수 없습니다' : undefined,
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
      disabled: locked,
      onSelect: handlers.rename,
    },
    {
      kind: 'item',
      id: 'color',
      label: '색 바꾸기',
      disabled: locked,
      submenu: paletteColors.map((color): MenuItem => ({
        kind: 'item',
        id: color,
        label: labelColorNames[color],
        swatch: color,
        check: 'radio',
        checked: item.color === color,
        onSelect: () => handlers.changeColor(color),
      })),
    },
    {
      kind: 'item',
      id: 'icon',
      label: '아이콘 바꾸기',
      disabled: locked,
      onSelect: handlers.changeIcon,
    },
    {
      kind: 'item',
      id: 'startup',
      label: '시작할 때 실행',
      check: 'checkbox',
      checked: item.runOnStartup === true,
      disabled: locked,
      onSelect: handlers.toggleStartup,
    },
  ];
}

function kindRow(
  row: ActionKindRow,
  full: boolean,
  handlers: MacroMenuHandlers,
): MenuItem {
  return {
    kind: 'item',
    id: row.kind,
    label: `${row.label}…`,
    icon: row.icon,
    disabled: full,
    onSelect: () => handlers.addAction(row.kind),
  };
}

function addActionEntries(
  input: MacroMenuInput,
  handlers: MacroMenuHandlers,
): readonly MenuEntry[] {
  const full = input.item.actions.length >= MACRO_FILE_LIMITS.actions;
  const row = (kind: MacroActionKind): MenuItem =>
    kindRow(ACTION_KINDS[kind], full, handlers);
  const {slideDestination, communication, audioInput, videoInput, capture} =
    LATER_KINDS;
  return [
    {
      kind: 'item',
      id: 'add-action',
      label: '동작 추가',
      disabled: input.locked,
      submenu: [
        {
          kind: 'item',
          id: 'clear',
          label: '지우기',
          icon: 'eraser',
          submenu: [row('clearAll'), row('clearLayer')].map(clear => ({
            ...clear,
            icon: undefined,
          })),
        },
        row('look'),
        row('stageLayout'),
        later(
          'slide-destination',
          slideDestination.label,
          slideDestination.icon,
        ),
        row('timer'),
        row('prop'),
        row('message'),
        row('notice'),
        row('media'),
        row('audio'),
        row('audioPlaylist'),
        later('communication', communication.label, communication.icon),
        later('audio-input', audioInput.label, audioInput.icon),
        later('video-input', videoInput.label, videoInput.icon),
        row('macro'),
        later('capture', capture.label, capture.icon),
        separator('palette-separator'),
        {
          kind: 'item',
          id: 'palette',
          label: '동작 팔레트',
          onSelect: handlers.openPalette,
        },
      ],
    },
    later('add-media-action', '미디어 동작 추가…'),
  ];
}

function editEntries(
  input: MacroMenuInput,
  handlers: MacroMenuHandlers,
): readonly MenuEntry[] {
  const {item, locked, targets} = input;
  const actions = item.actions;
  if (actions.length === 0) return [];
  const edits = actions.map((action, index): MenuItem => ({
    kind: 'item',
    id: `edit-${index}`,
    label: `동작 편집: ${macroActionName(action, targets)}…`,
    icon: actionIcon(action),
    disabled: locked || !isKnownMacroAction(action),
    onSelect: () => handlers.editAction(index),
  }));
  const removes = actions.map((action, index): MenuItem => ({
    kind: 'item',
    id: `remove-${index}`,
    label: macroActionName(action, targets),
    icon: actionIcon(action),
    onSelect: () => handlers.removeAction(index),
  }));
  const [only] = actions;
  if (actions.length === 1 && only !== undefined) {
    return [
      separator('edit-separator'),
      ...edits,
      {
        kind: 'item',
        id: 'remove-0',
        label: `동작 빼기: ${macroActionName(only, targets)}`,
        icon: actionIcon(only),
        disabled: locked,
        onSelect: () => handlers.removeAction(0),
      },
    ];
  }
  return [
    separator('edit-separator'),
    ...edits,
    separator('remove-separator'),
    {
      kind: 'item',
      id: 'remove-actions',
      label: '동작 빼기',
      disabled: locked,
      submenu: [
        ...removes,
        separator('remove-all-separator'),
        later('remove-all', '모두 빼기'),
      ],
    },
  ];
}

function clipboardEntries(
  input: MacroMenuInput,
  handlers: MacroMenuHandlers,
): readonly MenuEntry[] {
  const full = input.macroCount >= MACRO_FILE_LIMITS.macros;
  return [
    later('inspector', '속성…'),
    separator('clipboard-separator'),
    ...laterClipboardRows(),
    {
      kind: 'item',
      id: 'duplicate',
      label: '복제',
      icon: 'duplicate',
      disabled: input.locked || full,
      onSelect: handlers.duplicate,
    },
    separator('delete-separator'),
    {
      kind: 'item',
      id: 'delete',
      label: '삭제',
      icon: 'trash',
      danger: true,
      disabled: input.locked,
      onSelect: handlers.remove,
    },
  ];
}

/**
 * The 매크로 right-click menu, row for row as ProPresenter's (spec 11): its
 * collections, its look and startup, its actions, then copy and delete.
 */
export function macroMenuEntries(
  input: MacroMenuInput,
  handlers: MacroMenuHandlers,
): readonly MenuEntry[] {
  return [
    ...collectionEntries(input, handlers),
    separator('appearance-separator'),
    ...appearanceEntries(input, handlers),
    separator('add-separator'),
    ...addActionEntries(input, handlers),
    ...editEntries(input, handlers),
    separator('inspector-separator'),
    ...clipboardEntries(input, handlers),
  ];
}
