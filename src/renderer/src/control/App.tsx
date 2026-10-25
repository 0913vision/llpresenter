import {useState, useSyncExternalStore, type JSX} from 'react';
import type {ColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useClearKeys} from '@renderer/show/clearKeys';
import {MenuBar} from '@renderer/shell/MenuBar';
import {StatusBar} from '@renderer/shell/StatusBar';
import {openItem, useShow} from '@renderer/state/show';
import {NotificationStack} from '@renderer/ui/Notification';
import {Toolbar, type Workspace as WorkspaceId} from '@renderer/shell/Toolbar';
import {useSizeClass} from '@renderer/shell/useSizeClass';
import {useUiZoomKeys} from '@renderer/shell/uiZoomKeys';
import {Workspace} from '@renderer/shell/Workspace';
import type {ControlSession} from './controlSession';
import styles from './App.module.css';

export function App({
  columnWidthStore,
  session,
}: {
  readonly columnWidthStore: ColumnWidthStore;
  readonly session: ControlSession;
}): JSX.Element {
  const sizeClass = useSizeClass();
  const serviceName = useShow(view => view.serviceName);
  const [workspace, setWorkspace] = useState<WorkspaceId>('show');
  const notices = useSyncExternalStore(session.subscribe, session.getNotices);
  const [warningHeight, setWarningHeight] = useState(0);
  const onWorkspace = (next: WorkspaceId): void => {
    if (next === 'prep') session.startEditor();
    setWorkspace(next);
  };
  useClearKeys();
  useUiZoomKeys();
  return (
    <div className={styles.app} data-size={sizeClass}>
      <MenuBar title={serviceName} />
      <Toolbar
        sizeClass={sizeClass}
        workspace={workspace}
        onWorkspace={onWorkspace}
      />
      <Workspace
        id={workspace}
        sizeClass={sizeClass}
        store={columnWidthStore}
        onProblem={session.report}
        prep={
          session.api && session.editor
            ? {api: session.api, editor: session.editor}
            : undefined
        }
        onOpenPrep={itemId => {
          openItem(itemId);
          onWorkspace('prep');
          session.editor?.open(null);
        }}
        warningHeight={warningHeight}
      />
      <StatusBar />
      <NotificationStack
        notices={notices}
        compact={sizeClass === 'narrow'}
        onClose={session.dismiss}
        onWarningHeightChange={setWarningHeight}
      />
    </div>
  );
}
