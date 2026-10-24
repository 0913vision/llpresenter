import type {CSSProperties, JSX} from 'react';
import {defaultColumns, type SizeClass} from './sizeClass';
import type {Workspace as WorkspaceId} from './Toolbar';
import styles from './Workspace.module.css';

// TODO(0913vision): Let users drag the gaps to resize columns and remember the
// widths per size class.

type ColumnPanels = readonly string[];

const panelsByWorkspace: Readonly<
  Record<WorkspaceId, readonly [ColumnPanels, ColumnPanels, ColumnPanels]>
> = {
  show: [
    ['예배 순서', '퀵 실행'],
    ['장', '미디어'],
    ['미리보기', '진행 도구'],
  ],
  prep: [['예배 순서', '라이브러리'], ['편집'], ['항목 설정']],
  screens: [['화면'], ['배치'], ['속성']],
};

function Panel({title}: {readonly title: string}): JSX.Element {
  return (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.header}>
        <span className={styles.tab}>{title}</span>
      </div>
      <div className={styles.body} />
    </section>
  );
}

function gridStyle(sizeClass: SizeClass): CSSProperties {
  const {left, right} = defaultColumns[sizeClass];
  return {
    gridTemplateColumns: `${left}px minmax(var(--col-center-min), 1fr) ${right}px`,
  };
}

/** The three-column frame shared by all workspaces. */
export function Workspace({
  id,
  sizeClass,
}: {
  readonly id: WorkspaceId;
  readonly sizeClass: SizeClass;
}): JSX.Element {
  return (
    <main className={styles.columns} style={gridStyle(sizeClass)}>
      {panelsByWorkspace[id].map((panels, column) => (
        <div key={column} className={styles.column}>
          {panels.map(title => (
            <Panel key={title} title={title} />
          ))}
        </div>
      ))}
    </main>
  );
}
