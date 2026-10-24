// 창에 노출하는 API와 IPC 통로 이름. 프리로드와 메인이 같은 정의를 쓴다.
// 통로를 더할 때는 Channels, LlpApi, 프리로드(preload/index.ts), 메인(main/ipc.ts)에 함께 넣는다.

import type { LiveCommand } from './commands'
import type { LiveState } from './live'

export const Channels = {
  liveGet: 'live:get',
  liveCommand: 'live:command',
  liveChanged: 'live:changed',
  windowControl: 'window:control',
} as const

export type WindowAction = 'minimize' | 'toggle-maximize' | 'close'

export const windowActions: readonly WindowAction[] = ['minimize', 'toggle-maximize', 'close']

export type Unsubscribe = () => void

export interface LlpApi {
  readonly live: {
    get(): Promise<LiveState>
    send(command: LiveCommand): void
    /** 상태가 바뀔 때마다 부른다. 돌려받은 함수로 반드시 구독을 푼다. */
    subscribe(listener: (state: LiveState) => void): Unsubscribe
  }
  readonly window: {
    control(action: WindowAction): void
  }
}
