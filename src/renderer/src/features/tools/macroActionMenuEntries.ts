import {limitReason} from '@core/common/limitReason';
import {
  MACRO_FILE_LIMITS,
  isKnownMacroAction,
  type Macro,
  type MacroAction,
  type MacroActionKind,
  type KnownMacroAction,
} from '@core/schema/macros';
import type {MacroActionDraft} from '@core/macros/macroActionDraft';
import type {MacroActionDescriptor} from '@renderer/platform/macroActionDescriptor';
import {
  menuAvailability,
  type MenuEntry,
  type MenuItem,
} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import {macroActionChoices} from './macroActionChoices';
import {MACRO_ACTIONS} from './macroActionCatalog';
import type {MacroTargetChoice} from './macroTargets';

/** What the 동작 rows of the 매크로 menu can ask the panel to do. */
export interface MacroActionMenuHandlers {
  readonly addAction: (kind: MacroActionKind) => void;
  readonly chooseAction: (draft: MacroActionDraft, index?: number) => void;
  readonly openAction: (action: KnownMacroAction) => void;
  readonly removeAllActions: () => void;
  readonly openPalette: () => void;
  readonly removeAction: (index: number) => void;
}

/** What the 동작 rows of the 매크로 menu read from the 매크로 file. */
export interface MacroActionMenuInput {
  readonly item: Macro;
  readonly locked: boolean;
  /** Target names by action kind; undefined while they load. */
  readonly targets:
    | Partial<Readonly<Record<MacroActionKind, readonly MacroTargetChoice[]>>>
    | undefined;
}

/** ProPresenter's Add Action rows we don't have yet, by name and icon. */
const LATER_KINDS = {
  slideDestination: {label: '슬라이드 출력 대상', icon: 'slides'},
  communication: {label: '외부 장치 신호', icon: 'plugs'},
  audioInput: {label: '오디오 입력', icon: 'mic'},
  videoInput: {label: '영상 입력', icon: 'film'},
  capture: {label: '녹화와 방송', icon: 'capture'},
} as const;

function targetId(action: MacroAction): string | undefined {
  if (!isKnownMacroAction(action)) return undefined;
  switch (action.kind) {
    case 'theme':
      return action.theme;
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
 * The name a row gives an action: its target ("찬양" for a theme action), or
 * the kind when the action has no target or the targets are still loading.
 */
export function macroActionName(
  action: MacroAction,
  targets: MacroActionMenuInput['targets'],
): string {
  if (!isKnownMacroAction(action)) return '알 수 없는 동작';
  const kind = MACRO_ACTIONS[action.kind];
  if (action.kind === 'audio' && action.operation !== 'play') {
    return action.operation === 'stop' ? '오디오 정지' : '오디오 페이드 아웃';
  }
  const id = targetId(action);
  const name = targets?.[action.kind]?.find(choice => choice.id === id)?.name;
  if (name === undefined) return kind.label;
  return action.kind === 'clearLayer' ? `${name} 지우기` : name;
}

function actionIcon(action: MacroAction): string | undefined {
  return isKnownMacroAction(action)
    ? MACRO_ACTIONS[action.kind].icon
    : undefined;
}

function kindRow(
  row: MacroActionDescriptor,
  input: MacroActionMenuInput,
  handlers: MacroActionMenuHandlers,
): MenuItem {
  const full = input.item.actions.length >= MACRO_FILE_LIMITS.actions;
  const empty =
    row.kind !== 'audio' &&
    row.kind !== 'clearAll' &&
    !input.targets?.[row.kind]?.length;
  return {
    kind: 'item',
    id: row.kind,
    label: row.label,
    icon: row.icon,
    ...menuAvailability(
      full
        ? limitReason('동작', MACRO_FILE_LIMITS.actions)
        : empty
          ? input.targets === undefined
            ? '대상을 불러오고 있습니다'
            : '대상이 없습니다'
          : undefined,
    ),
    loadSubmenu: () =>
      macroActionChoices({
        kind: row.kind,
        targets: input.targets?.[row.kind],
        choose: handlers.chooseAction,
      }),
  };
}

function addActionEntries(
  input: MacroActionMenuInput,
  handlers: MacroActionMenuHandlers,
): readonly MenuEntry[] {
  const row = (kind: MacroActionKind): MenuItem =>
    kindRow(MACRO_ACTIONS[kind], input, handlers);
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
              ? limitReason('동작', MACRO_FILE_LIMITS.actions)
              : undefined,
          ),
          loadSubmenu: () => [
            {
              ...row('clearAll'),
              icon: undefined,
              loadSubmenu: undefined,
              onSelect: () => handlers.chooseAction({kind: 'clearAll'}),
            },
            menuSeparator('clear-layers'),
            ...macroActionChoices({
              kind: 'clearLayer',
              targets: input.targets?.clearLayer?.filter(
                target => target.clearTarget === 'layer',
              ),
              choose: handlers.chooseAction,
            }),
          ],
        },
        row('theme'),
        laterRow('slide-destination', slideDestination.label, {
          icon: slideDestination.icon,
          submenu: true,
        }),
        row('timer'),
        row('prop'),
        row('message'),
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
        menuSeparator('palette-separator'),
        {
          kind: 'item',
          id: 'palette',
          label: '동작 팔레트',
          onSelect: handlers.openPalette,
        },
      ],
    },
    laterRow('add-media-action', '미디어 동작 추가…'),
  ];
}

function editEntries(
  input: MacroActionMenuInput,
  handlers: MacroActionMenuHandlers,
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
        locked
          ? '매크로 목록 잠김'
          : !known
            ? '이번 버전에서는 쓸 수 없는 동작'
            : undefined,
      ),
      loadSubmenu: known
        ? () => [
            ...macroActionChoices({
              kind: action.kind,
              targets: targets?.[action.kind],
              current: action,
              choose: draft => handlers.chooseAction(draft, index),
            }),
            menuSeparator('action-remove-separator'),
            {
              kind: 'item',
              id: 'remove',
              label: `동작 삭제: ${macroActionName(action, targets)}`,
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
                      action.kind === 'theme'
                        ? '테마 편집…'
                        : `${MACRO_ACTIONS[action.kind].label} 열기…`,
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
      menuSeparator('edit-separator'),
      ...edits,
      {
        kind: 'item',
        id: 'remove-0',
        label: `동작 삭제: ${macroActionName(only, targets)}`,
        icon: actionIcon(only),
        ...menuAvailability(locked ? '매크로 목록 잠김' : undefined),
        onSelect: () => handlers.removeAction(0),
      },
    ];
  }
  return [
    menuSeparator('edit-separator'),
    ...edits,
    menuSeparator('remove-separator'),
    {
      kind: 'item',
      id: 'remove-actions',
      label: '동작 삭제',
      ...menuAvailability(locked ? '매크로 목록 잠김' : undefined),
      submenu: [
        ...removes,
        menuSeparator('remove-all-separator'),
        {
          kind: 'item',
          id: 'remove-all',
          label: '모두 삭제',
          onSelect: handlers.removeAllActions,
        },
      ],
    },
  ];
}

/**
 * The 동작 rows of the 매크로 menu: the 동작 추가 submenu, then an edit and a
 * remove row for each action the 매크로 holds.
 */
export function macroActionEntries(
  input: MacroActionMenuInput,
  handlers: MacroActionMenuHandlers,
): readonly MenuEntry[] {
  return [
    ...addActionEntries(input, handlers),
    ...editEntries(input, handlers),
  ];
}
