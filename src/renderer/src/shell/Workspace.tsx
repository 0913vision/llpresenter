import {Fragment, type JSX} from 'react';
import {ColumnGap} from './ColumnGap';
import type {ColumnWidthStore} from './columnWidthStore';
import type {SizeClass} from './sizeClass';
import type {Workspace as WorkspaceId} from './Toolbar';
import {useColumnLayout} from './useColumnLayout';
import styles from './Workspace.module.css';

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

/** The three-column frame shared by all workspaces. */
export function Workspace({
  id,
  sizeClass,
  store,
}: {
  readonly id: WorkspaceId;
  readonly sizeClass: SizeClass;
  readonly store: ColumnWidthStore;
}): JSX.Element {
  const {gridRef, drag} = useColumnLayout(sizeClass, store);
  return (
    <main ref={gridRef} className={styles.columns}>
      {panelsByWorkspace[id].map((panels, column) => (
        <Fragment key={column}>
          {column > 0 && (
            <ColumnGap column={column === 1 ? 'left' : 'right'} drag={drag} />
          )}
          <div className={styles.column}>
            {panels.map(title => (
              <Panel key={title} title={title} />
            ))}
          </div>
        </Fragment>
      ))}
    </main>
  );
}
