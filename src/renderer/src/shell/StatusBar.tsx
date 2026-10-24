// 상태 표시줄(28px). 출력 중인 화면은 이름 앞에 정상 점, 꺼진 화면은 흐린 이름만 둔다.
// 저장 상태와 fps는 저장소와 출력 창이 생긴 뒤에 채운다.

import type { JSX } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLive } from '@renderer/state/live'
import styles from './StatusBar.module.css'

const noOutputs: Readonly<Record<string, boolean>> = {}

const screens: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'main', label: '본 화면' },
  { id: 'stage', label: '무대 화면' },
  { id: 'broadcast', label: '방송 자막' },
]

export function StatusBar(): JSX.Element {
  const outputs = useLive(useShallow((view) => view.state?.outputs ?? noOutputs))
  return (
    <footer className={styles.bar}>
      <span className={styles.spacer} />
      {screens.map((screen) => {
        const on = outputs[screen.id] === true
        return (
          <span key={screen.id} className={on ? styles.item : `${styles.item} ${styles.off}`}>
            {on ? <span className={styles.dot} /> : null}
            {screen.label}
          </span>
        )
      })}
    </footer>
  )
}
