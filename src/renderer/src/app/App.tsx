import {useAudioOutputs} from '@renderer/features/preferences/useAudioOutputs';
import {ShownItemProvider} from '@renderer/session/show/shownItem';
import {NumberJumpOverlay} from '@renderer/features/presentation/keyboard/NumberJumpOverlay';
import {useMonitors} from '@renderer/features/screens/useMonitors';
import {AudioShortcuts} from '@renderer/features/tools/audio/AudioShortcuts';
import {MediaViewProvider} from '@renderer/features/media/MediaViewProvider';
import {ToolObjectShortcuts} from '@renderer/features/tools/ToolObjectShortcuts';
import {QuickObjectShortcuts} from '@renderer/features/quick/QuickObjectShortcuts';
import {Labels} from '@renderer/features/labels/labels';
import {usePrepActions} from './usePrepActions';
import {useWorkspaceSwitch} from './useWorkspaceSwitch';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import type {UiState} from '@core/schema/app/uiState';
import type {ColumnWidthStore} from '@renderer/app/shell/columns/columnWidthStore';
import {useClearKeys} from '@renderer/features/presentation/keyboard/clearKeys';
import {useLiveStateShortcuts} from '@renderer/features/tools/useLiveStateShortcuts';
import {MenuBar} from '@renderer/app/shell/menubar/MenuBar';
import {ScreenSummariesProvider} from '@renderer/platform/screens/ScreenSummaries';
import {StatusBar} from '@renderer/app/shell/StatusBar';
import {
  outputWarningCards,
  useOutputWarnings,
  warningScreens,
} from '@renderer/platform/screens/outputWarnings';
import {
  PrepItemNavigation,
  WorkspaceNavigation,
} from '@renderer/platform/WorkspaceNavigation';
import {watchInputModality} from '@renderer/ui/keys/inputModality';
import {NotificationStack} from '@renderer/ui/popups/Notification';
import {Toolbar} from '@renderer/app/shell/toolbar/Toolbar';
import {useSizeClass} from '@renderer/app/shell/useSizeClass';
import {useMediaStripVisibility} from '@renderer/app/shell/useMediaStripVisibility';
import {useSidebarCollapse} from '@renderer/app/shell/workspace/useSidebarCollapse';
import {useUiZoomKeys} from '@renderer/app/shell/uiZoomKeys';
import {useShortcutSettings} from '@renderer/platform/shortcuts/useShortcutSettings';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {workspaceShortcuts} from '@renderer/app/shell/menubar/workspaceShortcuts';
import {Workspace} from '@renderer/app/shell/workspace/Workspace';
import type {ControlSession} from './controlSession';
import {RecoveryPrompt} from './recovery/RecoveryPrompt';
import {useRecovery} from './recovery/useRecovery';
import {SavingDialog} from './SavingDialog';
import {useOutputNotices} from './notifications/useOutputNotices';
import {usePlaybackNotices} from './notifications/usePlaybackNotices';
import {useProblemNotices} from './notifications/useProblemNotices';
import styles from './App.module.css';
import {useLaunchReady} from './useLaunchReady';
import {UPDATE_NOTICE_KEY, useUpdate} from './update/useUpdate';
import {addNotice} from '@renderer/ui/popups/notices';
import {NoticeHistoryButton, useRememberNotice} from './shell/NoticeHistory';
import {BiblePassages} from '@renderer/features/bible/BiblePassages';
import {ServicePictures} from './ServicePictures';
import {BibleInsertionReview} from '@renderer/features/bible/split/BibleInsertionReview';
import {LoadReadiness, LoadReadinessContext} from '@renderer/ui/loadReadiness';
import {useShow} from '@renderer/session/show/showStore';

const noSubscription = (): (() => void) => () => undefined;

interface AppProps {
  readonly columnWidthStore: ColumnWidthStore;
  readonly session: ControlSession;
  readonly uiState?: UiState | undefined;
}

/** The control window: the menu bar, the toolbar, and 진행, 준비 and 화면 설정. */
export function App(props: AppProps): JSX.Element {
  const [readiness] = useState(() => new LoadReadiness());
  return (
    <LoadReadinessContext value={readiness}>
      <AppContent {...props} readiness={readiness} />
    </LoadReadinessContext>
  );
}

function AppContent(
  props: AppProps & {readonly readiness: LoadReadiness},
): JSX.Element {
  const monitors = useMonitors();
  return (
    <ScreenSummariesProvider
      onProblem={props.session.report}
      monitors={monitors}
    >
      <ControlApp {...props} />
    </ScreenSummariesProvider>
  );
}

/**
 * What the status bar says about saving: that the files are being saved as
 * the window closes, or that a save failed.
 */
function useSaveState(
  session: ControlSession,
): 'saving' | 'failed' | undefined {
  const saveFailed = useProblemNotices(session.api, session);
  const closeView = useSyncExternalStore(
    session.closeFlush?.subscribe ?? noSubscription,
    session.closeFlush?.getSnapshot ?? (() => 'hidden' as const),
  );
  if (closeView === 'saving') return 'saving';
  return saveFailed || closeView === 'failed' ? 'failed' : undefined;
}

function ControlApp({
  columnWidthStore,
  session,
  uiState = {},
  readiness,
}: AppProps & {readonly readiness: LoadReadiness}): JSX.Element {
  const recovery = useRecovery(session.api, session.report);
  const sizeClass = useSizeClass();
  const mediaStrip = useMediaStripVisibility(uiState.mediaStrip, session.api);
  const sidebar = useSidebarCollapse(sizeClass, uiState.layout, session.api);
  const serviceName = useShow(view => view.serviceName);
  const warningMap = useOutputWarnings(state => state.warnings);
  const warnings = useMemo(() => warningScreens(warningMap), [warningMap]);
  useAudioOutputs();
  const {
    workspace,
    shownFrame,
    savedPrepItem,
    themeLeave,
    switchTo: onWorkspace,
  } = useWorkspaceSwitch();
  const shownWorkspace = shownFrame.workspace;
  const [focusSearch, setFocusSearch] = useState(false);
  const searchFocused = useCallback(() => setFocusSearch(false), []);
  const notices = useSyncExternalStore(session.subscribe, session.getNotices);
  const resumeAfterUpdate = useCallback(() => session.resume(), [session]);
  const update = useUpdate(session.api?.update, resumeAfterUpdate);
  useRememberNotice(session, update.notice);
  const [warningHeight, setWarningHeight] = useState(0);
  const onMedia = (): void => {
    if (workspace === 'screens') onWorkspace('show');
    mediaStrip.setVisible(workspace === 'screens' || !mediaStrip.visible);
  };
  const textImport = session.api?.textImport;
  const prepActions = usePrepActions(session);
  useShortcutSettings(session.api);
  useWindowShortcuts([
    ...workspaceShortcuts({
      onWorkspace,
      onMedia,
      imported: prepActions.imported,
      editingSong: prepActions.editingSong,
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
      run: () => prepActions.importSong('file'),
    },
  ]);
  useClearKeys();
  useLiveStateShortcuts();
  useUiZoomKeys();
  useEffect(() => watchInputModality(window), []);
  useOutputNotices(session.api, session);
  usePlaybackNotices(session.api, session);
  useLaunchReady(session.api, readiness);
  const saveState = useSaveState(session);
  const content = (
    <div className={styles.app} data-size={sizeClass}>
      <BiblePassages />
      <ServicePictures />
      <BibleInsertionReview />
      <NumberJumpOverlay />
      <ToolObjectShortcuts api={session.api} onProblem={session.report} />
      <QuickObjectShortcuts api={session.api} onProblem={session.report} />
      <AudioShortcuts onProblem={session.report} />
      {update.dialog}
      <MenuBar
        onWorkspace={onWorkspace}
        onMedia={onMedia}
        clipboardAvailable={
          textImport && (() => textImport.clipboardAvailable())
        }
        onImportText={
          prepActions.canImport ? prepActions.importSong : undefined
        }
        onNewSong={session.api === undefined ? undefined : prepActions.newSong}
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
        workspace={shownWorkspace}
        onWorkspace={onWorkspace}
        onProblem={session.report}
        onOpenPrepSong={prepActions.openSong}
      />
      <ShownItemProvider shownItem={shownFrame.item}>
        <Workspace
          id={shownWorkspace}
          prepItemId={
            shownWorkspace === 'prep' ? shownFrame.item : savedPrepItem
          }
          sizeClass={sizeClass}
          store={columnWidthStore}
          onShowInLibrary={prepActions.openSong}
          onProblem={session.report}
          prep={prepActions.prep}
          prepTarget={shownFrame.prep}
          onOpenPrep={prepActions.onOpenPrep}
          warningHeight={warningHeight}
          mediaVisible={mediaStrip.visible}
          onMediaOpenChange={mediaStrip.setVisible}
          mediaApi={session.api}
          sidebar={sidebar}
          themeLeave={themeLeave}
        />
      </ShownItemProvider>
      <StatusBar
        standby={recovery.offer !== null}
        saveState={saveState}
        end={<NoticeHistoryButton session={session} />}
      />
      {prepActions.surface}
      <RecoveryPrompt recovery={recovery} />
      <NotificationStack
        notices={
          update.notice === null ? notices : addNotice(notices, update.notice)
        }
        compact={sizeClass === 'narrow'}
        onClose={key =>
          key === UPDATE_NOTICE_KEY ? update.dismiss() : session.dismiss(key)
        }
        onWarningHeightChange={setWarningHeight}
      />
      {session.closeFlush === undefined ? null : (
        <SavingDialog closeFlush={session.closeFlush} />
      )}
    </div>
  );
  return (
    <Labels value={session.labels ?? null}>
      <WorkspaceNavigation value={onWorkspace}>
        <PrepItemNavigation value={prepActions.onOpenPrep}>
          {session.api === undefined ? (
            content
          ) : (
            <MediaViewProvider
              api={session.api}
              active={shownWorkspace !== 'screens'}
              onProblem={session.report}
            >
              {content}
            </MediaViewProvider>
          )}
        </PrepItemNavigation>
      </WorkspaceNavigation>
    </Labels>
  );
}
