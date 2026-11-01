import type {MacroActionDescriptor} from '@renderer/platform/macroActionDescriptor';

/** The 매크로 actions that change what the screens show. */
export const SCREEN_MACRO_ACTIONS = {
  theme: {
    kind: 'theme',
    label: '테마 바꾸기',
    icon: 'layers',
    paletteGroup: '화면',
  },
  stageLayout: {
    kind: 'stageLayout',
    label: '무대 화면 배치',
    icon: 'monitor',
    paletteGroup: '화면',
  },
  clearAll: {
    kind: 'clearAll',
    label: '모두 지우기',
    icon: 'eraser',
    paletteGroup: '지우기',
  },
  clearLayer: {
    kind: 'clearLayer',
    label: '레이어 지우기',
    icon: 'eraser',
    paletteGroup: '지우기',
  },
} as const satisfies Readonly<Record<string, MacroActionDescriptor>>;
