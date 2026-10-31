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
}

/** The buttons of the 지우기 row, in the order of the design system. */
export const clearButtons: readonly ClearButtonSpec[] = [
  {
    command: 'clear.all',
    target: 'all',
    label: '모두',
    icon: 'layers',
  },
  {
    command: 'clear.slide',
    target: 'slide',
    label: '가사',
    icon: 'text',
  },
  {
    command: 'clear.media',
    target: 'media',
    label: '미디어',
    icon: 'image',
  },
  {
    command: 'clear.prop',
    target: 'prop',
    label: '그래픽',
    icon: 'prop',
  },
  {
    command: 'clear.audio',
    target: 'audio',
    label: '오디오',
    icon: 'audio',
  },
  {
    command: 'clear.message',
    target: 'message',
    label: '메시지',
    icon: 'msg',
  },
  {
    command: 'clear.notice',
    target: 'notice',
    label: '공지',
    icon: 'notice',
  },
];

/** Whether a layer, or any layer for 모두, holds something to clear. */
export function hasSomethingToClear(
  layers: LiveLayers,
  target: ClearTarget,
): boolean {
  return target === 'all' ? hasAnyLayer(layers) : layers[target] !== null;
}
