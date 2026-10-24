import type {LayerKind, MediaChoice, MessageLayer, SlideLayer} from './live';
import {parseLiveCommand} from './schema/liveCommand';

export type ClearTarget = LayerKind | 'all';

/**
 * A request to change the live state. Windows never change the state
 * directly; they send commands, and the main process applies them in order.
 */
export type LiveCommand =
  | {readonly type: 'slide.show'; readonly slide: SlideLayer}
  | {readonly type: 'media.show'; readonly media: MediaChoice}
  | {readonly type: 'message.show'; readonly message: MessageLayer}
  | {readonly type: 'layer.clear'; readonly target: ClearTarget}
  | {readonly type: 'clear.undo'}
  | {
      readonly type: 'output.set';
      readonly screenId: string;
      readonly on: boolean;
    };

export type LiveCommandType = LiveCommand['type'];

/**
 * Checks that a value received over IPC is a well-formed command of a known
 * type. Use `parseLiveCommand` to learn which field failed.
 */
export function isLiveCommand(value: unknown): value is LiveCommand {
  return parseLiveCommand(value).ok;
}
