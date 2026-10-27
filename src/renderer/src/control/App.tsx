import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import {TextImportFlow} from '@renderer/prep/import/TextImportFlow';
import type {UiState} from '@shared/schema/uiState';
import type {ColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useClearKeys} from '@renderer/show/clearKeys';
import {MenuBar} from '@renderer/shell/MenuBar';
import {ScreenSummariesProvider} from '@renderer/shell/ScreenSummaries';
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
import {useWindowShortcuts} from '@renderer/shell/windowShortcuts';
import {workspaceShortcuts} from '@renderer/shell/workspaceCommands';
import {Workspace} from '@renderer/shell/Workspace';
import type {ControlSession} from './controlSession';
import {RecoveryPrompt} from './recovery/RecoveryPrompt';
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
  useOutputNotices(session.api, session);
  useProblemNotices(session.api, session);
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
        mediaOpen={workspace !== 'screens' && mediaStrip.visible}
        onMediaOpenChange={
          workspace === 'screens' ? undefined : mediaStrip.setVisible
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
                onImportedSave: prepSelection.openSong,
              }
            : undefined
        }
        onOpenPrep={itemId => {
          onWorkspace('prep');
          const open = (): void => {
            prepSelection.clear();
            openItem(itemId);
            session.editor?.open(null);
          };
          if (session.editor === undefined) open();
          else session.editor.requestLeave(open);
        }}
        warningHeight={warningHeight}
        mediaVisible={mediaStrip.visible}
        mediaApi={session.api}
        sidebar={sidebar}
      />
      <StatusBar />
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
