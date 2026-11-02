import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import type {SongId} from '@core/schema/ids';
import {isItemOfKind} from '@core/schema/service';
import type {SongSlideSource} from '@core/schema/showService';
import {linearSlidesOf} from '@core/songs/blockModel';
import {itemSlideOrder} from '@core/songs/itemOrder';
import {TextImportFlow} from '@renderer/features/songs/import/TextImportFlow';
import {openItem, useShow} from '@renderer/session/show';
import {isLibrarySource} from '@renderer/session/showLibrary';
import type {ControlSession} from './controlSession';
import type {Workspace} from './shell/Toolbar';
import type {PrepBinding} from './workspaces/prepPanels';
import {usePrepSelection} from './usePrepSelection';
import {noticeTime} from '@renderer/ui/notices';

const noEditorSubscription = (): (() => void) => () => undefined;

interface ServiceSongTarget {
  readonly serviceId: string;
  readonly itemId: string;
  readonly position: number | undefined;
  readonly source: SongSlideSource | undefined;
}

async function openServiceSong(
  session: ControlSession,
  target: ServiceSongTarget,
  isCurrent: () => boolean,
): Promise<void> {
  const {api, editor} = session;
  if (api === undefined || editor === undefined) return;
  const service = await api.services.get(target.serviceId);
  if (!isCurrent()) return;
  const item = service?.service.order.find(item => item.id === target.itemId);
  if (item === undefined || !isItemOfKind(item, 'song')) {
    throw new Error('The service song is no longer available');
  }
  const document = await api.songs.get(item.song);
  if (!isCurrent()) return;
  if (document === null) throw new Error('The song is no longer available');
  const draft = editor.attach(document);
  if (draft === undefined) return;
  const song = draft.history.snapshot.song;
  const number = itemSlideOrder(song, {
    arrangement: item.arrangement,
    customOrder: item.customOrder,
  }).slides[target.position ?? 0];
  let block = number === undefined ? 0 : number - 1;
  const source = target.source;
  if (source !== undefined) {
    if (source.songId !== document.song.id) {
      throw new Error('The service song source has changed');
    }
    block = linearSlidesOf(song).findIndex(
      slide =>
        slide.groupId === source.groupId &&
        slide.slideIndex === source.slideIndex,
    );
    if (block < 0) throw new Error('The source slide is no longer available');
  }
  editor.open(document, {block, arrangement: item.arrangement});
}

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
  const songOpen = useRef(0);
  useEffect(
    () => () => {
      songOpen.current++;
    },
    [session],
  );
  useEffect(() => {
    if (workspace !== 'prep') songOpen.current++;
  }, [workspace]);
  const clearSelection = (): void => {
    songOpen.current++;
    prepSelection.clear();
  };
  const openSong = (songId: SongId, position?: number): void => {
    songOpen.current++;
    prepSelection.openSong(songId, position);
  };
  const importText = (source: 'file' | 'clipboard'): void => {
    if (session.api === undefined || importSource !== null) return;
    songOpen.current++;
    onWorkspace('prep');
    session.editor?.requestLeave(() => setImportSource(source));
  };
  const imported = useSyncExternalStore(
    session.editor?.subscribe ?? noEditorSubscription,
    () => session.editor?.getSnapshot().imported ?? false,
  );
  const onShowInLibrary = (songId: SongId): void => {
    songOpen.current++;
    const reveal = (): void => {
      onWorkspace('prep');
      prepSelection.openSong(songId);
    };
    if (session.editor) session.editor.requestLeave(reveal);
    else reveal();
  };
  const onOpenPrep = (itemId: string, position?: number): void => {
    const request = ++songOpen.current;
    onWorkspace('prep');
    const open = (): void => {
      if (request !== songOpen.current) return;
      const view = useShow.getState();
      if (isLibrarySource(view, itemId)) {
        prepSelection.openSong(view.librarySong.songId, position);
        return;
      }
      prepSelection.clear();
      openItem(itemId);
      session.editor?.open(null);
      if (
        view.serviceId !== null &&
        view.rows.some(row => row.id === itemId && row.kind === 'song')
      ) {
        const serviceId = view.serviceId;
        const isCurrent = (): boolean =>
          request === songOpen.current &&
          useShow.getState().serviceId === serviceId &&
          useShow.getState().openItemId === itemId &&
          session.editor?.getSnapshot().session === null;
        openServiceSong(
          session,
          {
            serviceId,
            itemId,
            position,
            source: view.tiles[itemId]?.[position ?? 0]?.sourceSlide,
          },
          isCurrent,
        ).catch(() => {
          if (!isCurrent()) return;
          session.report({
            key: 'prep:song-open',
            kind: 'warning',
            icon: 'warning',
            title: '곡 열기 실패',
            time: noticeTime(),
          });
        });
        return;
      }
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
            onServiceItemOpen: clearSelection,
            onImportedSave: openSong,
          }
        : undefined,
    imported: workspace === 'prep' && imported,
    canImport: session.api !== undefined && importSource === null,
    importText,
    openSong,
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
            clearSelection();
          }}
          onProblem={session.report}
        />
      ) : null,
  };
}
