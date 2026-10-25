import {useCallback, useState, type JSX} from 'react';
import type {ColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useClearKeys} from '@renderer/show/clearKeys';
import {MenuBar} from '@renderer/shell/MenuBar';
import {StatusBar} from '@renderer/shell/StatusBar';
import {openItem, useShow} from '@renderer/state/show';
import {NotificationStack} from '@renderer/ui/Notification';
import {addNotice, removeNotice, type Notice} from '@renderer/ui/notices';
import {Toolbar, type Workspace as WorkspaceId} from '@renderer/shell/Toolbar';
import {useSizeClass} from '@renderer/shell/useSizeClass';
import {useUiZoomKeys} from '@renderer/shell/uiZoomKeys';
import {Workspace} from '@renderer/shell/Workspace';
import styles from './App.module.css';

export function App({
  columnWidthStore,
}: {
  readonly columnWidthStore: ColumnWidthStore;
}): JSX.Element {
  const sizeClass = useSizeClass();
  const serviceName = useShow(view => view.serviceName);
  const [workspace, setWorkspace] = useState<WorkspaceId>('show');
  const [notices, setNotices] = useState<readonly Notice[]>([]);
  const [warningHeight, setWarningHeight] = useState(0);
  const onProblem = useCallback((notice: Notice) => {
    setNotices(current => addNotice(current, notice));
  }, []);
  useClearKeys();
  useUiZoomKeys();
  return (
    <div className={styles.app} data-size={sizeClass}>
      <MenuBar title={serviceName} />
      <Toolbar
        sizeClass={sizeClass}
        workspace={workspace}
        onWorkspace={setWorkspace}
      />
      <Workspace
        id={workspace}
        sizeClass={sizeClass}
        store={columnWidthStore}
        onProblem={onProblem}
        onOpenPrep={itemId => {
          openItem(itemId);
          setWorkspace('prep');
        }}
        warningHeight={warningHeight}
      />
      <StatusBar />
      <NotificationStack
        notices={notices}
        compact={sizeClass === 'narrow'}
        onClose={key => setNotices(current => removeNotice(current, key))}
        onWarningHeightChange={setWarningHeight}
      />
    </div>
  );
}
