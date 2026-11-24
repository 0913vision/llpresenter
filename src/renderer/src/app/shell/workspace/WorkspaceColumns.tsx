import {Fragment, type JSX} from 'react';
import {classNames} from '@renderer/ui/classNames';
import type {SizeClass} from '../../../ui/panels/sizeClass';
import {ColumnGap, type ColumnDrag} from '../columns/ColumnGap';
import type {ColumnWidthStore} from '../columns/columnWidthStore';
import {PanelColumn} from './PanelColumn';
import {CollapsedSidebar, type SidebarToggle} from './SidebarToggle';
import type {Workspace as WorkspaceId} from '../toolbar/Toolbar';
import type {WorkspacePanels} from './WorkspacePanel';
import styles from './Workspace.module.css';

/**
 * The columns of one workspace with the gaps that resize them. A folded left
 * column shows only its 사이드바 펼치기 strip.
 */
export function WorkspaceColumns({
  workspace,
  panels: {columns, partsOf},
  collapsed,
  visible,
  sizeClass,
  store,
  drag,
  toggle,
  warningHeight,
}: {
  readonly workspace: WorkspaceId;
  readonly panels: WorkspacePanels;
  readonly collapsed: boolean;
  readonly visible: boolean;
  readonly sizeClass: SizeClass;
  readonly store: ColumnWidthStore;
  readonly drag: ColumnDrag;
  readonly toggle: SidebarToggle;
  /** How far the warning cards reach into the last column. */
  readonly warningHeight: number;
}): JSX.Element {
  const right = workspace === 'prep' ? 'prepRight' : 'right';
  return (
    <div
      data-size={sizeClass}
      inert={!visible}
      className={classNames(styles.columns, collapsed && styles.leftCollapsed)}
    >
      {columns.map((titles, column) => (
        <Fragment key={column}>
          {column === 1 && collapsed ? <div aria-hidden="true" /> : null}
          {column > 0 && !(column === 1 && collapsed) ? (
            <ColumnGap column={column === 1 ? 'left' : right} drag={drag} />
          ) : null}
          {column === 0 && collapsed ? (
            <div className={styles.column} data-panel="예배 순서">
              <CollapsedSidebar
                claimFocus={toggle.claimFocus}
                onPress={(button, keyboard) =>
                  toggle.toggle(false, button, keyboard)
                }
              />
            </div>
          ) : (
            <PanelColumn
              workspace={workspace}
              titles={titles}
              partsOf={partsOf}
              store={store}
              sizeClass={sizeClass}
              draft={columns[1]?.[0] === '편집'}
              warningHeight={column === columns.length - 1 ? warningHeight : 0}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
