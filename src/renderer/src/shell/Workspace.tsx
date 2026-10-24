import {Fragment, type JSX, type ReactNode} from 'react';
import {ClearRow} from '@renderer/show/ClearRow';
import {ServiceOrderList} from '@renderer/show/ServiceOrderList';
import {
  SlidePanelBody,
  SlidePanelMeta,
  ThumbnailSizeSlider,
} from '@renderer/show/SlidePanel';
import {useShowKeys} from '@renderer/show/shortcuts';
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
    ['미리보기', '지우기', '진행 도구'],
  ],
  prep: [['예배 순서', '라이브러리'], ['편집'], ['항목 설정']],
  screens: [['화면'], ['배치'], ['속성']],
};

interface PanelParts {
  // NOTE(0913vision): `bare` draws its content without the panel around it,
  // as the 지우기 row does.
  readonly bare?: ReactNode;
  readonly body?: ReactNode;
  readonly meta?: ReactNode;
  readonly footer?: ReactNode;
}

function Panel({
  title,
  parts,
}: {
  readonly title: string;
  readonly parts: PanelParts;
}): JSX.Element {
  if (parts.bare) return <div className={styles.bare}>{parts.bare}</div>;
  return (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.header}>
        <span className={styles.tab}>{title}</span>
        {parts.meta}
      </div>
      <div className={styles.body}>{parts.body}</div>
      {parts.footer ? (
        <div className={styles.footer}>{parts.footer}</div>
      ) : null}
    </section>
  );
}

function ShowShortcuts(): null {
  useShowKeys();
  return null;
}

function showPanelParts(title: string, sizeClass: SizeClass): PanelParts {
  switch (title) {
    case '예배 순서':
      return {body: <ServiceOrderList />};
    case '지우기':
      return {bare: <ClearRow compact={sizeClass === 'narrow'} />};
    case '장':
      return {
        body: <SlidePanelBody sizeClass={sizeClass} />,
        meta: <SlidePanelMeta />,
        footer: <ThumbnailSizeSlider sizeClass={sizeClass} />,
      };
    default:
      return {};
  }
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
      {id === 'show' ? <ShowShortcuts /> : null}
      {panelsByWorkspace[id].map((panels, column) => (
        <Fragment key={column}>
          {column > 0 && (
            <ColumnGap column={column === 1 ? 'left' : 'right'} drag={drag} />
          )}
          <div className={styles.column}>
            {panels.map(title => (
              <Panel
                key={title}
                title={title}
                parts={id === 'show' ? showPanelParts(title, sizeClass) : {}}
              />
            ))}
          </div>
        </Fragment>
      ))}
    </main>
  );
}
