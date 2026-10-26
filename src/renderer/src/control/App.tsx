import {useState, useSyncExternalStore, type JSX} from 'react';
import type {UiState} from '@shared/schema/uiState';
import type {ColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useClearKeys} from '@renderer/show/clearKeys';
import {MenuBar} from '@renderer/shell/MenuBar';
import {StatusBar} from '@renderer/shell/StatusBar';
import {openItem, useShow} from '@renderer/state/show';
import {NotificationStack} from '@renderer/ui/Notification';
import {Toolbar, type Workspace as WorkspaceId} from '@renderer/shell/Toolbar';
import {useSizeClass} from '@renderer/shell/useSizeClass';
import {useMediaStripVisibility} from '@renderer/shell/useMediaStripVisibility';
import {useUiZoomKeys} from '@renderer/shell/uiZoomKeys';
import {Workspace} from '@renderer/shell/Workspace';
import type {ControlSession} from './controlSession';
import styles from './App.module.css';

export function App({
  columnWidthStore,
  session,
  uiState = {},
}: {
  readonly columnWidthStore: ColumnWidthStore;
  readonly session: ControlSession;
  readonly uiState?: UiState | undefined;
}): JSX.Element {
  const sizeClass = useSizeClass();
  const mediaStrip = useMediaStripVisibility(
    sizeClass,
    uiState.mediaStrip,
    session.api,
  );
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
        onProblem={session.report}
        mediaOpen={workspace === 'show' && mediaStrip.visible}
        onMediaOpenChange={
          workspace === 'show' ? mediaStrip.setVisible : undefined
        }
      />
      <Workspace
        id={workspace}
        sizeClass={sizeClass}
        store={columnWidthStore}
        onProblem={session.report}
        prep={
          session.api && session.editor && session.items
            ? {api: session.api, editor: session.editor, items: session.items}
            : undefined
        }
        onOpenPrep={itemId => {
          openItem(itemId);
          onWorkspace('prep');
          session.editor?.open(null);
        }}
        warningHeight={warningHeight}
        mediaVisible={mediaStrip.visible}
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
