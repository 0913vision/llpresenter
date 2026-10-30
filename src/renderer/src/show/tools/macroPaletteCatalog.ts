import {macroActionKinds, type MacroActionKind} from '@core/schema/macros';

export const MACRO_ACTION_MIME = 'application/x-llpresenter-macro-action';

export interface PaletteAction {
  readonly kind: MacroActionKind;
  readonly label: string;
}
export interface PaletteGroup {
  readonly label: string;
  readonly actions: readonly PaletteAction[];
}

export const MACRO_PALETTE: readonly PaletteGroup[] = [
  {
    label: '화면',
    actions: [
      {kind: 'look', label: 'Look 바꾸기'},
      {kind: 'stageLayout', label: '무대 화면 배치'},
    ],
  },
  {
    label: '지우기',
    actions: [
      {kind: 'clearAll', label: '모두 지우기'},
      {kind: 'clearLayer', label: '레이어 지우기'},
    ],
  },
  {
    label: '내용',
    actions: [
      {kind: 'media', label: '배경 미디어'},
      {kind: 'prop', label: '소품'},
      {kind: 'message', label: '메시지'},
      {kind: 'notice', label: '공지'},
    ],
  },
  {
    label: '소리',
    actions: [
      {kind: 'audio', label: '오디오'},
      {kind: 'audioPlaylist', label: '오디오 재생 목록'},
    ],
  },
  {
    label: '진행',
    actions: [
      {kind: 'timer', label: '타이머'},
      {kind: 'macro', label: '매크로'},
    ],
  },
];

export function readMacroActionDrag(
  value: string,
): MacroActionKind | undefined {
  return macroActionKinds.find(kind => kind === value);
}

export function searchMacroPalette(query: string): readonly PaletteGroup[] {
  const search = query.trim().toLocaleLowerCase();
  if (!search) return MACRO_PALETTE;
  return MACRO_PALETTE.flatMap(group => {
    const actions = group.actions.filter(action =>
      action.label.toLocaleLowerCase().includes(search),
    );
    return actions.length ? [{...group, actions}] : [];
  });
}
