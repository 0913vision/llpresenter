import type {ClearTarget} from './commands';
import {hasAnyLayer, type LiveLayers} from './state';

/** Command IDs of the clear commands, as in `docs/spec/10-shortcuts-and-settings.md`. */
export type ClearCommandId =
  | 'clear.all'
  | 'clear.slide'
  | 'clear.media'
  | 'clear.prop'
  | 'clear.audio'
  | 'clear.message'
  | 'clear.notice';

export interface ClearButtonSpec {
  readonly command: ClearCommandId;
  readonly target: ClearTarget;
  /** The one-word name on the button. */
  readonly label: string;
  /** The file name of the icon in `ui/icons/`. */
  readonly icon: string;
  /** The `KeyboardEvent.code` of the shortcut. */
  readonly code: string;
  /** The shortcut as it is written in tooltips and `aria-keyshortcuts`. */
  readonly shortcut: string;
}

/** The buttons of the 지우기 row, in the order of the design system. */
export const clearButtons: readonly ClearButtonSpec[] = [
  {
    command: 'clear.all',
    target: 'all',
    label: '모두',
    icon: 'layers',
    code: 'F1',
    shortcut: 'F1',
  },
  {
    command: 'clear.slide',
    target: 'slide',
    label: '가사',
    icon: 'text',
    code: 'F2',
    shortcut: 'F2',
  },
  {
    command: 'clear.media',
    target: 'media',
    label: '미디어',
    icon: 'image',
    code: 'F3',
    shortcut: 'F3',
  },
  {
    command: 'clear.prop',
    target: 'prop',
    label: '그래픽',
    icon: 'prop',
    code: 'F4',
    shortcut: 'F4',
  },
  {
    command: 'clear.audio',
    target: 'audio',
    label: '오디오',
    icon: 'audio',
    code: 'F5',
    shortcut: 'F5',
  },
  {
    command: 'clear.message',
    target: 'message',
    label: '메시지',
    icon: 'msg',
    code: 'F6',
    shortcut: 'F6',
  },
  {
    command: 'clear.notice',
    target: 'notice',
    label: '공지',
    icon: 'notice',
    code: 'F7',
    shortcut: 'F7',
  },
];

/** Whether a layer, or any layer for 모두, holds something to clear. */
export function hasSomethingToClear(
  layers: LiveLayers,
  target: ClearTarget,
): boolean {
  return target === 'all' ? hasAnyLayer(layers) : layers[target] !== null;
}
