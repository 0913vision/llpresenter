// 출력 상태 처리. 부수 효과 없는 순수 함수라서 Electron 없이 시험한다.
// 같은 상태를 돌려주면 "바뀐 것 없음"이다. 그때는 판 번호도 늘리지 않고 창에 보내지도 않는다.

import type { LiveCommand } from '@shared/commands'
import { emptyLayers, hasAnyLayer, type LayerKind, type LiveLayers, type LiveState } from '@shared/live'

/** 되돌릴 수 있는 지우기의 수. 넘으면 가장 오래된 것부터 버린다. */
export const UNDO_LIMIT = 20

export interface LiveHistory {
  readonly state: LiveState
  /** 지우기 직전의 층들. 마지막이 가장 최근. */
  readonly undo: readonly LiveLayers[]
}

export function initialHistory(state: LiveState): LiveHistory {
  return { state, undo: [] }
}

function withLayers(history: LiveHistory, layers: LiveLayers, undo: readonly LiveLayers[]): LiveHistory {
  return { state: { ...history.state, version: history.state.version + 1, layers }, undo }
}

function pushUndo(undo: readonly LiveLayers[], layers: LiveLayers): readonly LiveLayers[] {
  const next = [...undo, layers]
  return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next
}

function setLayer<K extends LayerKind>(history: LiveHistory, kind: K, value: LiveLayers[K]): LiveHistory {
  if (history.state.layers[kind] === value) return history
  return withLayers(history, { ...history.state.layers, [kind]: value }, history.undo)
}

function clear(history: LiveHistory, target: LayerKind | 'all'): LiveHistory {
  const layers = history.state.layers
  if (target === 'all') {
    if (!hasAnyLayer(layers)) return history
    return withLayers(history, emptyLayers(), pushUndo(history.undo, layers))
  }
  if (layers[target] === null) return history
  return withLayers(history, { ...layers, [target]: null }, pushUndo(history.undo, layers))
}

function undoClear(history: LiveHistory): LiveHistory {
  const previous = history.undo.at(-1)
  if (previous === undefined) return history
  return withLayers(history, previous, history.undo.slice(0, -1))
}

function setOutput(history: LiveHistory, screenId: string, on: boolean): LiveHistory {
  const current = history.state.outputs[screenId] ?? false
  if (current === on) return history
  const state = history.state
  return { ...history, state: { ...state, version: state.version + 1, outputs: { ...state.outputs, [screenId]: on } } }
}

export function applyCommand(history: LiveHistory, command: LiveCommand): LiveHistory {
  switch (command.type) {
    case 'slide.show':
      return setLayer(history, 'slide', command.slide)
    case 'media.show':
      return setLayer(history, 'media', command.media)
    case 'message.show':
      return setLayer(history, 'message', command.message)
    case 'layer.clear':
      return clear(history, command.target)
    case 'clear.undo':
      return undoClear(history)
    case 'output.set':
      return setOutput(history, command.screenId, command.on)
    default: {
      const unknown: never = command
      return unknown
    }
  }
}
