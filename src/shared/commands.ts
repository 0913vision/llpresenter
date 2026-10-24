import {
  isBoolean,
  isNonEmptyString,
  isNonNegativeInteger,
  isNullableString,
  isRecord,
  isString,
  isStringArray,
  type UnknownRecord,
} from './guards';
import {
  layerKinds,
  type LayerKind,
  type MediaChoice,
  type MessageLayer,
  type SlideLayer,
} from './live';

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

function isLayerKind(value: unknown): value is LayerKind {
  return isString(value) && layerKinds.some(kind => kind === value);
}

function isClearTarget(value: unknown): value is ClearTarget {
  return value === 'all' || isLayerKind(value);
}

function isSlideLayer(value: unknown): value is SlideLayer {
  return (
    isRecord(value) &&
    isNonEmptyString(value['itemId']) &&
    isNonNegativeInteger(value['position']) &&
    isNullableString(value['label']) &&
    isStringArray(value['lines'])
  );
}

function isMediaChoice(value: unknown): value is MediaChoice {
  return (
    isRecord(value) &&
    isNonEmptyString(value['mediaId']) &&
    isBoolean(value['loop'])
  );
}

function isMessageLayer(value: unknown): value is MessageLayer {
  return (
    isRecord(value) &&
    isNonEmptyString(value['messageId']) &&
    isString(value['text'])
  );
}

function hasValidPayload(value: UnknownRecord): boolean {
  switch (value['type']) {
    case 'slide.show':
      return isSlideLayer(value['slide']);
    case 'media.show':
      return isMediaChoice(value['media']);
    case 'message.show':
      return isMessageLayer(value['message']);
    case 'layer.clear':
      return isClearTarget(value['target']);
    case 'clear.undo':
      return true;
    case 'output.set':
      return isNonEmptyString(value['screenId']) && isBoolean(value['on']);
    default:
      return false;
  }
}

/** Checks that a value received over IPC is a well-formed command of a known type. */
export function isLiveCommand(value: unknown): value is LiveCommand {
  return isRecord(value) && hasValidPayload(value);
}
