// 툴바. 왼쪽 작업 공간 탭, 가운데 검색, 오른쪽 Look과 화면 출력 버튼.
// 좁은 창에서는 높이 40에 이름을 아이콘 오른쪽에 둔다(디자인 시스템 Toolbar, ToolbarButton).

import type { JSX } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Icon } from '@renderer/ui/Icon'
import { sendLive, useLive } from '@renderer/state/live'
import type { SizeClass } from './sizeClass'
import styles from './Toolbar.module.css'

export type Workspace = 'show' | 'prep' | 'screens'

const workspaces: readonly { readonly id: Workspace; readonly icon: string; readonly label: string }[] = [
  { id: 'show', icon: 'slides', label: '진행' },
  { id: 'prep', icon: 'edit', label: '준비' },
  { id: 'screens', icon: 'gear', label: '화면 설정' },
]

/** 기본 화면 셋. 화면 목록은 화면 설정이 정하며, 그 저장은 output 묶음에서 만든다. */
const screens: readonly { readonly id: string; readonly icon: string; readonly label: string; readonly target: string }[] = [
  { id: 'main', icon: 'mplay', label: '본 화면', target: '모니터 2' },
  { id: 'stage', icon: 'mplay', label: '무대', target: '모니터 3' },
  { id: 'broadcast', icon: 'capture', label: '방송 자막', target: 'NDI' },
]

const noOutputs: Readonly<Record<string, boolean>> = {}

export interface ToolbarProps {
  readonly sizeClass: SizeClass
  readonly workspace: Workspace
  readonly onWorkspace: (workspace: Workspace) => void
}

export function Toolbar({ sizeClass, workspace, onWorkspace }: ToolbarProps): JSX.Element {
  // 출력 상태가 바뀌어도 화면 출력 켜짐이 그대로면 다시 그리지 않는다.
  const outputs = useLive(useShallow((view) => view.state?.outputs ?? noOutputs))
  const compact = sizeClass === 'compact'
  const button = compact ? `${styles.button} ${styles.compact}` : styles.button

  return (
    <header className={compact ? `${styles.bar} ${styles.barCompact}` : styles.bar}>
      <div className={styles.group} role="tablist" aria-label="작업 공간">
        {workspaces.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === workspace}
            className={`${button} ${styles.tab}`}
            onClick={() => onWorkspace(item.id)}
          >
            <Icon name={item.icon} size={compact ? 16 : 18} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <span className={styles.divider} />
      <button type="button" className={button} title="미디어">
        <Icon name="film" size={compact ? 16 : 18} />
        {compact ? null : <span>미디어</span>}
      </button>

      <div className={styles.center}>
        <label className={styles.search}>
          <Icon name="search" size={16} />
          <input type="search" placeholder="곡, 가사, 초성" aria-label="검색" />
        </label>
      </div>

      <button type="button" className={button} aria-haspopup="menu">
        <span className={styles.look}>
          <Icon name="layers" size={compact ? 16 : 18} />
          <Icon name="down" size={12} className={styles.chevron} />
        </span>
        <span>평상시</span>
      </button>
      <span className={styles.divider} />
      {screens.map((screen) => {
        const on = outputs[screen.id] === true
        return (
          <button
            key={screen.id}
            type="button"
            aria-pressed={on}
            data-state={on ? 'live' : 'off'}
            className={`${button} ${styles.output}`}
            title={`${screen.label} 출력 ${on ? '끄기' : '켜기'} (${screen.target})`}
            onClick={() => sendLive({ type: 'output.set', screenId: screen.id, on: !on })}
          >
            <span className={styles.outputIcon}>
              <Icon name={screen.icon} size={compact ? 16 : 18} />
              {on ? <span className={styles.dot} /> : null}
            </span>
            <span>{screen.label}</span>
          </button>
        )
      })}
    </header>
  )
}
