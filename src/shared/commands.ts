// 출력 상태를 바꾸는 명령. 창은 상태를 직접 고치지 않고 명령을 메인에 보낸다.
// 메인은 명령을 하나씩 순서대로 처리하므로 되돌림, 기록, 복구가 같은 길을 쓴다.
// 명령을 더할 때는 LiveCommand와 isLiveCommand, 메인의 처리(main/live/reducer.ts)와 그 시험에 함께 넣는다.

import {
  isBoolean,
  isNonEmptyString,
  isNonNegativeInteger,
  isNullableString,
  isRecord,
  isString,
  isStringArray,
  type UnknownRecord,
} from './guards'
import { layerKinds, type LayerKind, type MediaLayer, type MessageLayer, type SlideLayer } from './live'

export type ClearTarget = LayerKind | 'all'

export type LiveCommand =
  | { readonly type: 'slide.show'; readonly slide: SlideLayer }
  | { readonly type: 'media.show'; readonly media: MediaLayer }
  | { readonly type: 'message.show'; readonly message: MessageLayer }
  | { readonly type: 'layer.clear'; readonly target: ClearTarget }
  | { readonly type: 'clear.undo' }
  | { readonly type: 'output.set'; readonly screenId: string; readonly on: boolean }

export type LiveCommandType = LiveCommand['type']

function isLayerKind(value: unknown): value is LayerKind {
  return isString(value) && layerKinds.some((kind) => kind === value)
}

function isClearTarget(value: unknown): value is ClearTarget {
  return value === 'all' || isLayerKind(value)
}

function isSlideLayer(value: unknown): value is SlideLayer {
  return (
    isRecord(value) &&
    isNonEmptyString(value['itemId']) &&
    isNonNegativeInteger(value['position']) &&
    isNullableString(value['label']) &&
    isStringArray(value['lines'])
  )
}

function isMediaLayer(value: unknown): value is MediaLayer {
  return isRecord(value) && isNonEmptyString(value['mediaId']) && isBoolean(value['loop'])
}

function isMessageLayer(value: unknown): value is MessageLayer {
  return isRecord(value) && isNonEmptyString(value['messageId']) && isString(value['text'])
}

function checkCommand(value: UnknownRecord): boolean {
  switch (value['type']) {
    case 'slide.show':
      return isSlideLayer(value['slide'])
    case 'media.show':
      return isMediaLayer(value['media'])
    case 'message.show':
      return isMessageLayer(value['message'])
    case 'layer.clear':
      return isClearTarget(value['target'])
    case 'clear.undo':
      return true
    case 'output.set':
      return isNonEmptyString(value['screenId']) && isBoolean(value['on'])
    default:
      return false
  }
}

/** IPC로 들어온 값이 명령인지 검사한다. 모르는 종류나 모양이 틀린 값은 false. */
export function isLiveCommand(value: unknown): value is LiveCommand {
  return isRecord(value) && checkCommand(value)
}
