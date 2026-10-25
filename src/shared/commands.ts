import type {LayerKind, MediaChoice, MessageLayer, SlideLayer} from './live';
import {parseLiveCommand} from './schema/liveCommand';
import type {LiveAction} from './schema/liveActions';

export type ClearTarget = LayerKind | 'all';

/**
 * A request to change the live state. Windows never change the state
 * directly; they send commands, and the main process applies them in order.
 */
export type SingleLiveCommand =
  | LiveAction
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

/** A bounded, flat transaction. Nested batches are not supported. */
export interface LiveBatch {
  readonly type: 'live.batch';
  readonly commands: readonly SingleLiveCommand[];
}

export type LiveCommand = SingleLiveCommand | LiveBatch;

export type LiveCommandType = LiveCommand['type'];

/** Whether this command interrupts pending song-output navigation. */
export function interruptsSongOutput(command: LiveCommand): boolean {
  switch (command.type) {
    case 'slide.show':
    case 'media.show':
    case 'clear.undo':
      return true;
    case 'layer.clear':
      return ['all', 'slide', 'media'].includes(command.target);
    case 'live.batch':
      return command.commands.some(interruptsSongOutput);
    case 'message.show':
    case 'output.set':
    case 'look.set':
    case 'stage.layout.set':
    case 'stage.message.set':
    case 'prop.set':
    case 'notice.start':
    case 'notice.pause':
    case 'notice.stop':
    case 'message.send':
    case 'timer.start':
    case 'timer.pause':
    case 'timer.reset':
    case 'audio.play':
    case 'audio.pause':
    case 'audio.next':
    case 'audio.previous':
    case 'audio.fadeOut':
    case 'audio.volume.set':
    case 'macro.run':
    case 'item.start':
      return false;
    default: {
      const unhandled: never = command;
      return unhandled;
    }
  }
}

/**
 * Checks that a value received over IPC is a well-formed command of a known
 * type. Use `parseLiveCommand` to learn which field failed.
 */
export function isLiveCommand(value: unknown): value is LiveCommand {
  return parseLiveCommand(value).ok;
}
