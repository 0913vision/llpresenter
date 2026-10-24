// 세 작업 공간이 같이 쓰는 3열 틀. 열 너비는 창 크기 구간의 기본값이고, 열 끌기는 1단계 뒤에 넣는다.
// 패널의 내용은 각 작업 공간 묶음(show, prep, screens)이 채운다.

import type { CSSProperties, JSX } from 'react'
import { defaultColumns, type SizeClass } from './sizeClass'
import type { Workspace as WorkspaceId } from './Toolbar'
import styles from './Workspace.module.css'

interface Column {
  readonly panels: readonly string[]
}

/** 작업 공간마다 열의 패널 이름(시안 보드 기준). */
const layouts: Readonly<Record<WorkspaceId, readonly [Column, Column, Column]>> = {
  show: [{ panels: ['예배 순서', '퀵 실행'] }, { panels: ['장', '미디어'] }, { panels: ['미리보기', '진행 도구'] }],
  prep: [{ panels: ['예배 순서', '라이브러리'] }, { panels: ['편집'] }, { panels: ['항목 설정'] }],
  screens: [{ panels: ['화면'] }, { panels: ['배치'] }, { panels: ['속성'] }],
}

function Panel({ title }: { readonly title: string }): JSX.Element {
  return (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.header}>
        <span className={styles.tab}>{title}</span>
      </div>
      <div className={styles.body} />
    </section>
  )
}

export function Workspace({ id, sizeClass }: { readonly id: WorkspaceId; readonly sizeClass: SizeClass }): JSX.Element {
  const [left, center, right] = layouts[id]
  const widths = defaultColumns[sizeClass]
  const style: CSSProperties = { gridTemplateColumns: `${widths.left}px minmax(var(--col-center-min), 1fr) ${widths.right}px` }
  return (
    <main className={styles.columns} style={style}>
      {[left, center, right].map((column, index) => (
        <div key={index} className={styles.column}>
          {column.panels.map((title) => (
            <Panel key={title} title={title} />
          ))}
        </div>
      ))}
    </main>
  )
}
