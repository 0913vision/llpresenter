// 화면 쪽 출력 상태. 메인이 보낸 사본만 들고, 바꾸는 일은 명령으로 메인에 보낸다.

import { create } from 'zustand'
import type { LiveCommand } from '@shared/commands'
import type { LiveState } from '@shared/live'

interface LiveView {
  /** 아직 받지 못했거나 Electron 밖(브라우저 미리보기)이면 null */
  readonly state: LiveState | null
}

export const useLive = create<LiveView>(() => ({ state: null }))

function accept(next: LiveState): void {
  const current = useLive.getState().state
  // 늦게 도착한 옛 판은 버린다.
  if (current !== null && next.version < current.version) return
  useLive.setState({ state: next })
}

/** 메인의 출력 상태를 받기 시작한다. 돌려받은 함수로 반드시 멈춘다. */
export function startLiveSync(): () => void {
  const api = window.llp
  if (api === undefined) return () => undefined
  const unsubscribe = api.live.subscribe(accept)
  api.live.get().then(accept, () => undefined)
  return unsubscribe
}

export function sendLive(command: LiveCommand): void {
  window.llp?.live.send(command)
}
