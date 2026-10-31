import {
  MACRO_FILE_LIMITS,
  isKnownMacroAction,
  type Macro,
  type MacroAction,
  type MacroActionKind,
  type MacroCollection,
  type KnownMacroAction,
} from '@core/schema/macros';
import {
  menuAvailability,
  type MenuEntry,
  type MenuItem,
} from '@renderer/ui/menuModel';
import type {MacroTargetChoice} from './macroTargets';
import {macroActionChoices} from './macroActionChoices';
import type {MacroActionDraft} from '@core/macros/macroActionDraft';
import {
  laterClipboardRows,
  laterRow,
  menuSeparator,
} from '@renderer/ui/menuRows';

/** What the 매크로 menu can ask its panel to do. */
export interface MacroMenuHandlers {
  readonly rename: () => void;
  readonly changeIcon: () => void;
  readonly changeColor: () => void;
  readonly toggleStartup: () => void;
  readonly addTo: (collection: MacroCollection['id']) => void;
  readonly moveTo: (collection: MacroCollection['id']) => void;
  readonly newCollection: () => void;
  readonly addAction: (kind: MacroActionKind) => void;
  readonly chooseAction: (draft: MacroActionDraft, index?: number) => void;
  readonly openAction: (action: KnownMacroAction) => void;
  readonly removeAllActions: () => void;
  readonly openPalette: () => void;
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
      ...menuAvailability(marked(collection) ? '현재 포함된 모음' : undefined),
      onSelect: () => choose(collection.id),
    })),
    ...(input.collections.length > 0 ? [separator('new-separator')] : []),
    {
      kind: 'item',
      id: 'new',
      label: '새 모음',
      ...menuAvailability(full ? '모음 한도 도달' : undefined),
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
      ...menuAvailability(locked ? '매크로 목록 잠김' : undefined),
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
      ...menuAvailability(
        locked
          ? '매크로 목록 잠김'
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
      ...menuAvailability(locked ? '매크로 목록 잠김' : undefined),
      onSelect: handlers.rename,
    },
    {
      kind: 'item',
      id: 'color',
      label: '색 바꾸기',
      ...menuAvailability(locked ? '매크로 목록 잠김' : undefined),
      onSelect: handlers.changeColor,
    },
    {
      kind: 'item',
      id: 'icon',
      label: '아이콘 바꾸기',
      ...menuAvailability(locked ? '매크로 목록 잠김' : undefined),
      onSelect: handlers.changeIcon,
    },
    {
      kind: 'item',
      id: 'startup',
      label: '시작할 때 실행',
      check: 'checkbox',
      checked: item.runOnStartup === true,
      ...menuAvailability(locked ? '매크로 목록 잠김' : undefined),
      onSelect: handlers.toggleStartup,
    },
  ];
}

function kindRow(
  row: ActionKindRow,
  input: MacroMenuInput,
  handlers: MacroMenuHandlers,
): MenuItem {
  const dialog = row.kind === 'stageLayout';
  const full = input.item.actions.length >= MACRO_FILE_LIMITS.actions;
  const empty =
    !dialog &&
    row.kind !== 'audio' &&
    row.kind !== 'clearAll' &&
    !input.targets?.[row.kind]?.length;
  return {
    kind: 'item',
    id: row.kind,
    label: `${row.label}${dialog ? '…' : ''}`,
    icon: row.icon,
    ...menuAvailability(
      full
        ? '동작 한도 도달'
        : empty
          ? input.targets === undefined
            ? '대상을 불러오고 있습니다'
            : '대상이 없습니다'
          : dialog &&
              input.item.actions.some(action => action.kind === 'stageLayout')
            ? '무대 배치 동작이 이미 있음'
            : undefined,
    ),
    loadSubmenu: dialog
      ? undefined
      : () =>
          macroActionChoices({
            kind: row.kind,
            targets: input.targets?.[row.kind],
            choose: handlers.chooseAction,
          }),
    onSelect: dialog ? () => handlers.addAction(row.kind) : undefined,
  };
}

function addActionEntries(
  input: MacroMenuInput,
  handlers: MacroMenuHandlers,
): readonly MenuEntry[] {
  const row = (kind: MacroActionKind): MenuItem =>
    kindRow(ACTION_KINDS[kind], input, handlers);
  const {slideDestination, communication, audioInput, videoInput, capture} =
    LATER_KINDS;
  return [
    {
      kind: 'item',
      id: 'add-action',
      label: '동작 추가',
      ...menuAvailability(input.locked ? '매크로 목록 잠김' : undefined),
      submenu: [
        {
          kind: 'item',
          id: 'clear',
          label: '지우기',
          icon: 'eraser',
          ...menuAvailability(
            input.item.actions.length >= MACRO_FILE_LIMITS.actions
              ? '동작 한도 도달'
              : undefined,
          ),
          loadSubmenu: () => [
            {
              ...row('clearAll'),
              icon: undefined,
              loadSubmenu: undefined,
              onSelect: () => handlers.chooseAction({kind: 'clearAll'}),
            },
            separator('clear-layers'),
            ...macroActionChoices({
              kind: 'clearLayer',
              targets: input.targets?.clearLayer?.filter(
                target => target.clearTarget === 'layer',
              ),
              choose: handlers.chooseAction,
            }),
          ],
        },
        row('look'),
        row('stageLayout'),
        laterRow('slide-destination', slideDestination.label, {
          icon: slideDestination.icon,
          submenu: true,
        }),
        row('timer'),
        row('prop'),
        row('message'),
        row('notice'),
        row('media'),
        row('audio'),
        row('audioPlaylist'),
        laterRow('communication', communication.label, {
          icon: communication.icon,
          submenu: true,
        }),
        laterRow('audio-input', audioInput.label, {
          icon: audioInput.icon,
          submenu: true,
        }),
        laterRow('video-input', videoInput.label, {
          icon: videoInput.icon,
          submenu: true,
        }),
        row('macro'),
        laterRow('capture', capture.label, {icon: capture.icon, submenu: true}),
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
  const edits = actions.map((action, index): MenuItem => {
    const known = isKnownMacroAction(action);
    return {
      kind: 'item',
      id: `edit-${index}`,
      label: `동작 편집: ${macroActionName(action, targets)}`,
      icon: actionIcon(action),
      ...menuAvailability(
        locked ? '매크로 목록 잠김' : !known ? '지원하지 않는 동작' : undefined,
      ),
      loadSubmenu: known
        ? () => [
            ...macroActionChoices({
              kind: action.kind,
              targets: targets?.[action.kind],
              current: action,
              choose: draft => handlers.chooseAction(draft, index),
            }),
            separator('action-remove-separator'),
            {
              kind: 'item',
              id: 'remove',
              label: `동작 빼기: ${macroActionName(action, targets)}`,
              icon: actionIcon(action),
              onSelect: () => handlers.removeAction(index),
            },
            ...(action.kind === 'clearAll' ||
            action.kind === 'clearLayer' ||
            action.kind === 'media'
              ? []
              : [
                  {
                    kind: 'item' as const,
                    id: 'open',
                    label:
                      action.kind === 'look'
                        ? 'Look 편집…'
                        : `${ACTION_KINDS[action.kind].label} 열기…`,
                    onSelect: () => handlers.openAction(action),
                  },
                ]),
          ]
        : undefined,
    };
  });
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
        ...menuAvailability(locked ? '매크로 목록 잠김' : undefined),
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
      ...menuAvailability(locked ? '매크로 목록 잠김' : undefined),
      submenu: [
        ...removes,
        separator('remove-all-separator'),
        {
          kind: 'item',
          id: 'remove-all',
          label: '모두 빼기',
          onSelect: handlers.removeAllActions,
        },
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
      ...menuAvailability(
        input.locked
          ? '매크로 목록 잠김'
          : full
            ? '매크로 한도 도달'
            : undefined,
      ),
      onSelect: handlers.duplicate,
    },
    separator('delete-separator'),
    {
      kind: 'item',
      id: 'delete',
      label: '삭제',
      icon: 'trash',
      danger: true,
      ...menuAvailability(input.locked ? '매크로 목록 잠김' : undefined),
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
