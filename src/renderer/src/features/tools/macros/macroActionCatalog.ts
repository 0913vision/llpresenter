import type {MacroActionKind} from '@core/schema/macros';
import type {MacroActionDescriptor} from '@renderer/platform/macroActionDescriptor';
import {MEDIA_MACRO_ACTIONS} from '@renderer/features/media/macroActions';
import {SCREEN_MACRO_ACTIONS} from '@renderer/features/screens/macroActions';

const TOOLS_MACRO_ACTIONS = {
  timer: {
    kind: 'timer',
    label: '타이머',
    icon: 'timer',
    paletteGroup: '진행',
  },
  prop: {
    kind: 'prop',
    label: '그래픽',
    icon: 'prop',
    paletteGroup: '내용',
  },
  message: {
    kind: 'message',
    label: '메시지',
    icon: 'msg',
    paletteGroup: '내용',
  },
  macro: {
    kind: 'macro',
    label: '매크로',
    icon: 'macro',
    paletteGroup: '진행',
  },
} as const satisfies Readonly<Record<string, MacroActionDescriptor>>;

/** Every kind a 매크로 can run, with its name, icon, and palette group. */
export const MACRO_ACTIONS: Readonly<
  Record<MacroActionKind, MacroActionDescriptor>
> = {
  ...SCREEN_MACRO_ACTIONS,
  ...MEDIA_MACRO_ACTIONS,
  ...TOOLS_MACRO_ACTIONS,
};
