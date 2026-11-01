import {AudioShortcuts} from '@renderer/features/tools/AudioShortcuts';
import {ToolObjectShortcuts} from '@renderer/features/tools/ToolObjectShortcuts';
import {QuickObjectShortcuts} from '@renderer/features/quick/QuickObjectShortcuts';
import {usePrepActions} from './usePrepActions';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import type {UiState} from '@core/schema/uiState';
import type {ColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useClearKeys} from '@renderer/features/presentation/clearKeys';
import {useLiveStateShortcuts} from '@renderer/features/tools/useLiveStateShortcuts';
import {MenuBar} from '@renderer/app/shell/MenuBar';
import {ScreenSummariesProvider} from '@renderer/platform/ScreenSummaries';
import {StatusBar} from '@renderer/app/shell/StatusBar';
import {
  outputWarningCards,
  useOutputWarnings,
  warningScreens,
} from '@renderer/platform/outputWarnings';
import {useShow} from '@renderer/session/show';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {watchInputModality} from '@renderer/ui/inputModality';
import {NotificationStack} from '@renderer/ui/Notification';
import {
  Toolbar,
  type Workspace as WorkspaceId,
} from '@renderer/app/shell/Toolbar';
import {useSizeClass} from '@renderer/app/shell/useSizeClass';
import {useMediaStripVisibility} from '@renderer/app/shell/useMediaStripVisibility';
import {useSidebarCollapse} from '@renderer/app/shell/useSidebarCollapse';
import {useUiZoomKeys} from '@renderer/app/shell/uiZoomKeys';
import {useShortcutSettings} from '@renderer/platform/useShortcutSettings';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {workspaceShortcuts} from '@renderer/app/shell/workspaceCommands';
import {Workspace} from '@renderer/app/shell/Workspace';
import type {ControlSession} from './controlSession';
import {RecoveryPrompt} from './recovery/RecoveryPrompt';
import {useRecovery} from './recovery/useRecovery';
import {SavingDialog} from './SavingDialog';
import {useOutputNotices} from './notifications/useOutputNotices';
import {useProblemNotices} from './notifications/useProblemNotices';
import styles from './App.module.css';

const noEditorSubscription = (): (() => void) => () => undefined;

interface AppProps {
  readonly columnWidthStore: ColumnWidthStore;
  readonly session: ControlSession;
  readonly uiState?: UiState | undefined;
}

export function App(props: AppProps): JSX.Element {
  return (
    <ScreenSummariesProvider onProblem={props.session.report}>
      <ControlApp {...props} />
    </ScreenSummariesProvider>
  );
}

function ControlApp({
  columnWidthStore,
  session,
  uiState = {},
}: AppProps): JSX.Element {
  const recovery = useRecovery(session.api, session.report);
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
  const [focusSearch, setFocusSearch] = useState(false);
  const searchFocused = useCallback(() => setFocusSearch(false), []);
  const notices = useSyncExternalStore(session.subscribe, session.getNotices);
  const [warningHeight, setWarningHeight] = useState(0);
  const onWorkspace = (next: WorkspaceId): void => {
    if (next === 'prep') session.startEditor();
    setWorkspace(next);
  };
  const onMedia = (): void => {
    if (workspace === 'screens') onWorkspace('show');
    mediaStrip.setVisible(workspace === 'screens' || !mediaStrip.visible);
  };
  const textImport = session.api?.textImport;
  const prepActions = usePrepActions({session, workspace, onWorkspace});
  useShortcutSettings(session.api);
  useWindowShortcuts([
    ...workspaceShortcuts({
      onWorkspace,
      onMedia,
      imported: prepActions.imported,
    }),
    {
      id: 'search.focus',
      run: () => {
        if (workspace === 'screens') onWorkspace('show');
        setFocusSearch(true);
      },
    },
    {
      id: 'import.textFile',
      when: () => prepActions.canImport,
      run: () => prepActions.importText('file'),
    },
  ]);
  useClearKeys();
  useLiveStateShortcuts();
  useUiZoomKeys();
  useEffect(() => watchInputModality(window), []);
  useOutputNotices(session.api, session);
  const saveFailed = useProblemNotices(session.api, session);
  const closeView = useSyncExternalStore(
    session.closeFlush?.subscribe ?? noEditorSubscription,
    session.closeFlush?.getSnapshot ?? (() => 'hidden' as const),
  );
  const saveState =
    closeView === 'saving'
      ? 'saving'
      : saveFailed || closeView === 'failed'
        ? 'failed'
        : undefined;
  return (
    <div className={styles.app} data-size={sizeClass}>
      <ToolObjectShortcuts api={session.api} onProblem={session.report} />
      <QuickObjectShortcuts api={session.api} onProblem={session.report} />
      <AudioShortcuts onProblem={session.report} />
      <MenuBar
        onWorkspace={onWorkspace}
        onMedia={onMedia}
        clipboardAvailable={
          textImport && (() => textImport.clipboardAvailable())
        }
        onImportText={
          prepActions.canImport ? prepActions.importText : undefined
        }
        title={serviceName}
        onProblem={session.report}
        warnings={warnings}
        onShowWarning={screenId => {
          for (const notice of outputWarningCards(screenId)) {
            session.report(notice);
          }
        }}
      />
      <Toolbar
        focusSearch={focusSearch}
        onSearchFocused={searchFocused}
        sizeClass={sizeClass}
        workspace={workspace}
        onWorkspace={onWorkspace}
        onProblem={session.report}
        onOpenPrepSong={prepActions.openSong}
      />
      <WorkspaceNavigation value={onWorkspace}>
        <Workspace
          id={workspace}
          sizeClass={sizeClass}
          store={columnWidthStore}
          onShowInLibrary={prepActions.onShowInLibrary}
          onProblem={session.report}
          prep={prepActions.prep}
          onOpenPrep={prepActions.onOpenPrep}
          warningHeight={warningHeight}
          mediaVisible={mediaStrip.visible}
          onMediaOpenChange={mediaStrip.setVisible}
          mediaApi={session.api}
          sidebar={sidebar}
        />
      </WorkspaceNavigation>
      <StatusBar standby={recovery.offer !== null} saveState={saveState} />
      {prepActions.importSurface}
      <RecoveryPrompt recovery={recovery} />
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
