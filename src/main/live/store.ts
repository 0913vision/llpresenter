// 출력 상태의 유일한 원본. 명령을 받아 처리하고, 바뀌었을 때만 구독자에게 알린다.
// Electron에 기대지 않으므로 창에 보내는 일은 ipc.ts가 구독자로 맡는다.

import type { LiveCommand } from '@shared/commands'
import { emptyLiveState, type LiveState } from '@shared/live'
import { applyCommand, initialHistory, type LiveHistory } from './reducer'

export type LiveListener = (state: LiveState) => void

export class LiveStore {
  private history: LiveHistory
  private readonly listeners = new Set<LiveListener>()

  constructor(initial: LiveState = emptyLiveState()) {
    this.history = initialHistory(initial)
  }

  get state(): LiveState {
    return this.history.state
  }

  /** 명령을 처리하고 상태가 바뀌었으면 true. 구독자의 오류는 다른 구독자와 상태에 번지지 않는다. */
  dispatch(command: LiveCommand, onListenerError?: (error: unknown) => void): boolean {
    const next = applyCommand(this.history, command)
    if (next === this.history) return false
    this.history = next
    for (const listener of this.listeners) {
      try {
        listener(next.state)
      } catch (error) {
        onListenerError?.(error)
      }
    }
    return true
  }

  subscribe(listener: LiveListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get listenerCount(): number {
    return this.listeners.size
  }
}
