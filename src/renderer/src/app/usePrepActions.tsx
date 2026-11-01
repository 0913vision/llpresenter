import {useCallback, useState, useSyncExternalStore, type JSX} from 'react';
import type {SongId} from '@core/schema/ids';
import {TextImportFlow} from '@renderer/features/songs/import/TextImportFlow';
import {openItem, useShow} from '@renderer/session/show';
import {isLibrarySource} from '@renderer/session/showLibrary';
import type {ControlSession} from './controlSession';
import type {Workspace} from './shell/Toolbar';
import type {PrepBinding} from './workspaces/prepPanels';
import {usePrepSelection} from './usePrepSelection';

const noEditorSubscription = (): (() => void) => () => undefined;

/** App's existing editor binding, guarded navigation, and text-import surface. */
export interface PrepActions {
  readonly prep: PrepBinding | undefined;
  readonly imported: boolean;
  readonly canImport: boolean;
  readonly importText: (source: 'file' | 'clipboard') => void;
  readonly openSong: (songId: SongId, position?: number) => void;
  readonly onShowInLibrary: (songId: SongId) => void;
  readonly onOpenPrep: (itemId: string, position?: number) => void;
  readonly importSurface: JSX.Element | null;
}

/** Uses the window's one editor and selection handoff, preserving leave guards. */
export function usePrepActions({
  session,
  workspace,
  onWorkspace,
}: {
  readonly session: ControlSession;
  readonly workspace: Workspace;
  readonly onWorkspace: (workspace: Workspace) => void;
}): PrepActions {
  const [importSource, setImportSource] = useState<'file' | 'clipboard' | null>(
    null,
  );
  const closeImport = useCallback(() => setImportSource(null), []);
  const prepSelection = usePrepSelection();
  const importText = (source: 'file' | 'clipboard'): void => {
    if (session.api === undefined || importSource !== null) return;
    onWorkspace('prep');
    session.editor?.requestLeave(() => setImportSource(source));
  };
  const imported = useSyncExternalStore(
    session.editor?.subscribe ?? noEditorSubscription,
    () => session.editor?.getSnapshot().imported ?? false,
  );
  const onShowInLibrary = (songId: SongId): void => {
    const reveal = (): void => {
      onWorkspace('prep');
      prepSelection.openSong(songId);
    };
    if (session.editor) session.editor.requestLeave(reveal);
    else reveal();
  };
  const onOpenPrep = (itemId: string, position?: number): void => {
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
  };
  return {
    prep:
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
        : undefined,
    imported: workspace === 'prep' && imported,
    canImport: session.api !== undefined && importSource === null,
    importText,
    openSong: prepSelection.openSong,
    onShowInLibrary,
    onOpenPrep,
    importSurface:
      session.api && session.editor && importSource !== null ? (
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
      ) : null,
  };
}
