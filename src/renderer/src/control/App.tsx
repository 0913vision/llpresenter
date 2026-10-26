import {useMemo, useState, useSyncExternalStore, type JSX} from 'react';
import type {UiState} from '@shared/schema/uiState';
import type {ColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useClearKeys} from '@renderer/show/clearKeys';
import {MenuBar} from '@renderer/shell/MenuBar';
import {StatusBar} from '@renderer/shell/StatusBar';
import {
  outputWarningCards,
  useOutputWarnings,
  warningScreens,
} from '@renderer/state/outputWarnings';
import {openItem, useShow} from '@renderer/state/show';
import {NotificationStack} from '@renderer/ui/Notification';
import {Toolbar, type Workspace as WorkspaceId} from '@renderer/shell/Toolbar';
import {useSizeClass} from '@renderer/shell/useSizeClass';
import {useMediaStripVisibility} from '@renderer/shell/useMediaStripVisibility';
import {useSidebarCollapse} from '@renderer/shell/useSidebarCollapse';
import {useUiZoomKeys} from '@renderer/shell/uiZoomKeys';
import {Workspace} from '@renderer/shell/Workspace';
import type {ControlSession} from './controlSession';
import {RecoveryPrompt} from './recovery/RecoveryPrompt';
import {SavingDialog} from './SavingDialog';
import {useOutputNotices} from './notifications/useOutputNotices';
import {useProblemNotices} from './notifications/useProblemNotices';
import {usePrepSelection} from './usePrepSelection';
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
  const sidebar = useSidebarCollapse(sizeClass, uiState.layout, session.api);
  const serviceName = useShow(view => view.serviceName);
  const warningMap = useOutputWarnings(state => state.warnings);
  const warnings = useMemo(() => warningScreens(warningMap), [warningMap]);
  const [workspace, setWorkspace] = useState<WorkspaceId>('show');
  const [prepMedia, setPrepMedia] = useState(false);
  const prepSelection = usePrepSelection();
  const notices = useSyncExternalStore(session.subscribe, session.getNotices);
  const [warningHeight, setWarningHeight] = useState(0);
  const onWorkspace = (next: WorkspaceId): void => {
    if (next === 'prep') session.startEditor();
    setWorkspace(next);
  };
  useClearKeys();
  useUiZoomKeys();
  useOutputNotices(session.api, session);
  useProblemNotices(session.api, session);
  return (
    <div className={styles.app} data-size={sizeClass}>
      <MenuBar
        title={serviceName}
        warnings={warnings}
        onShowWarning={screenId => {
          for (const notice of outputWarningCards(screenId)) {
            session.report(notice);
          }
        }}
      />
      <Toolbar
        sizeClass={sizeClass}
        workspace={workspace}
        onWorkspace={onWorkspace}
        onProblem={session.report}
        onOpenPrepSong={prepSelection.openSong}
        mediaOpen={
          workspace === 'show'
            ? mediaStrip.visible
            : workspace === 'prep' && prepMedia
        }
        onMediaOpenChange={
          workspace === 'show'
            ? mediaStrip.setVisible
            : workspace === 'prep'
              ? setPrepMedia
              : undefined
        }
      />
      <Workspace
        id={workspace}
        sizeClass={sizeClass}
        store={columnWidthStore}
        onProblem={session.report}
        prep={
          session.api && session.editor && session.items
            ? {
                api: session.api,
                editor: session.editor,
                items: session.items,
                selectionRequest: prepSelection.request,
                onSelectionHandled: prepSelection.handled,
                onServiceItemOpen: prepSelection.clear,
              }
            : undefined
        }
        onOpenPrep={itemId => {
          prepSelection.clear();
          openItem(itemId);
          onWorkspace('prep');
          session.editor?.open(null);
        }}
        warningHeight={warningHeight}
        mediaVisible={mediaStrip.visible}
        mediaView={prepMedia}
        sidebar={sidebar}
      />
      <StatusBar />
      <RecoveryPrompt api={session.api} onProblem={session.report} />
      <NotificationStack
        notices={notices}
        compact={sizeClass === 'narrow'}
        onClose={session.dismiss}
        onWarningHeightChange={setWarningHeight}
      />
      {session.closeFlush === undefined ? null : (
        <SavingDialog closeFlush={session.closeFlush} />
      )}
    </div>
  );
}
