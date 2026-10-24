// 메뉴줄(30px). 창 제목줄을 겸하므로 빈 곳을 끌면 창이 움직인다.
// 메뉴의 내용은 1단계 뒤에 Menu 컴포넌트로 채운다.

import type { JSX } from 'react'
import type { WindowAction } from '@shared/ipc'
import { Icon } from '@renderer/ui/Icon'
import styles from './MenuBar.module.css'

const menus = ['파일', '편집', '보기', '출력', '창', '도움말'] as const

const controls: readonly { readonly action: WindowAction; readonly icon: string; readonly label: string }[] = [
  { action: 'minimize', icon: 'min', label: '최소화' },
  { action: 'toggle-maximize', icon: 'max', label: '최대화' },
  { action: 'close', icon: 'x', label: '닫기' },
]

export function MenuBar({ title }: { readonly title: string }): JSX.Element {
  return (
    <div className={styles.bar}>
      <span className={styles.wordmark}>LoveLight</span>
      <nav className={styles.menus} aria-label="메뉴">
        {menus.map((menu) => (
          <button key={menu} type="button" className={styles.menu}>
            {menu}
          </button>
        ))}
      </nav>
      <span className={styles.title}>{title}</span>
      <div className={styles.controls}>
        {controls.map((control) => (
          <button
            key={control.action}
            type="button"
            className={styles.control}
            aria-label={control.label}
            title={control.label}
            onClick={() => window.llp?.window.control(control.action)}
          >
            <Icon name={control.icon} size={14} />
          </button>
        ))}
      </div>
    </div>
  )
}
