import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import {TextImportFlow} from '@renderer/features/songs/import/TextImportFlow';
import type {UiState} from '@core/schema/uiState';
import type {ColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useClearKeys} from '@renderer/features/presentation/clearKeys';
import {MenuBar} from '@renderer/app/shell/MenuBar';
import {ScreenSummariesProvider} from '@renderer/platform/ScreenSummaries';
import {StatusBar} from '@renderer/app/shell/StatusBar';
import {
  outputWarningCards,
  useOutputWarnings,
  warningScreens,
} from '@renderer/platform/outputWarnings';
import {openItem, useShow} from '@renderer/session/show';
import {isLibrarySource} from '@renderer/session/showLibrary';
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
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {workspaceShortcuts} from '@renderer/app/shell/workspaceCommands';
import {Workspace} from '@renderer/app/shell/Workspace';
import type {ControlSession} from './controlSession';
import {RecoveryPrompt} from './recovery/RecoveryPrompt';
import {useRecovery} from './recovery/useRecovery';
import {SavingDialog} from './SavingDialog';
import {useOutputNotices} from './notifications/useOutputNotices';
import {useProblemNotices} from './notifications/useProblemNotices';
import {usePrepSelection} from './usePrepSelection';
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
  const [importSource, setImportSource] = useState<'file' | 'clipboard' | null>(
    null,
  );
  const closeImport = useCallback(() => setImportSource(null), []);
  const textImport = session.api?.textImport;
  const prepSelection = usePrepSelection();
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
  const importText = (source: 'file' | 'clipboard'): void => {
    if (session.api === undefined || importSource !== null) return;
    onWorkspace('prep');
    session.editor?.requestLeave(() => setImportSource(source));
  };
  const imported = useSyncExternalStore(
    session.editor?.subscribe ?? noEditorSubscription,
    () => session.editor?.getSnapshot().imported ?? false,
  );
  useWindowShortcuts([
    ...workspaceShortcuts({
      onWorkspace,
      onMedia,
      imported: workspace === 'prep' && imported,
    }),
    {
      code: 'KeyF',
      ctrl: true,
      run: () => {
        if (workspace === 'screens') onWorkspace('show');
        setFocusSearch(true);
      },
    },
    {
      code: 'KeyI',
      ctrl: true,
      shift: true,
      when: () => session.api !== undefined && importSource === null,
      run: () => importText('file'),
    },
  ]);
  useClearKeys();
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
      <MenuBar
        onWorkspace={onWorkspace}
        onMedia={onMedia}
        clipboardAvailable={
          textImport && (() => textImport.clipboardAvailable())
        }
        onImportText={
          session.api && importSource === null ? importText : undefined
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
        onOpenPrepSong={prepSelection.openSong}
      />
      <WorkspaceNavigation value={onWorkspace}>
        <Workspace
          id={workspace}
          sizeClass={sizeClass}
          store={columnWidthStore}
          onShowInLibrary={songId => {
            const reveal = (): void => {
              onWorkspace('prep');
              prepSelection.openSong(songId);
            };
            if (session.editor) session.editor.requestLeave(reveal);
            else reveal();
          }}
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
                  onImportedSave: prepSelection.openSong,
                }
              : undefined
          }
          onOpenPrep={(itemId, position) => {
            onWorkspace('prep');
            const open = (): void => {
              const view = useShow.getState();
              if (isLibrarySource(view, itemId)) {
                prepSelection.openSong(view.librarySong.songId, position);
                return;
              }
              prepSelection.clear();
              openItem(itemId);
              session.editor?.open(null);
              if (position !== undefined && view.serviceId !== null) {
                session.items?.show({serviceId: view.serviceId, itemId});
                session.items?.selectPosition(position);
              }
            };
            if (session.editor === undefined) open();
            else session.editor.requestLeave(open);
          }}
          warningHeight={warningHeight}
          mediaVisible={mediaStrip.visible}
          onMediaOpenChange={mediaStrip.setVisible}
          mediaApi={session.api}
          sidebar={sidebar}
        />
      </WorkspaceNavigation>
      <StatusBar standby={recovery.offer !== null} saveState={saveState} />
      {session.api && session.editor && importSource !== null ? (
        <TextImportFlow
          api={session.api}
          store={session.editor}
          source={importSource}
          onDone={closeImport}
          onEdit={() => {
            prepSelection.clear();
          }}
          onProblem={session.report}
        />
      ) : null}
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
