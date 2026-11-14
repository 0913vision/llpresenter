import {PowerPointImagesFlow} from './PowerPointImagesFlow';
import {PowerPointImportFlow} from '@renderer/features/songs/import/PowerPointImportFlow';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import {
  createServiceId,
  createServiceItemId,
  type SongId,
} from '@core/schema/ids';
import {isItemOfKind} from '@core/schema/service';
import {contentPosition} from './prepCardPosition';
import type {SongSlideSource} from '@core/schema/showService';
import {TextImportFlow} from '@renderer/features/songs/import/TextImportFlow';
import {openItem, useShow} from '@renderer/session/show';
import {isLibrarySource} from '@renderer/session/showLibrary';
import type {ControlSession} from './controlSession';
import type {Workspace} from './shell/Toolbar';
import type {PrepBinding} from './workspaces/prepPanels';
import {usePrepSelection} from './usePrepSelection';
import {noticeTime} from '@renderer/ui/notices';
import {InlineSongController} from '@renderer/features/songs/editor/InlineSongController';
import type {SongEditorWindowModel} from '@renderer/features/songs/editor/useSongEditorWindow';
import {useSlidesEditor} from '@renderer/features/service/slides/useSlidesEditor';

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
  if (!isCurrent() || service === null) return;
  const block =
    target.source === undefined
      ? contentPosition(item, target.position)
      : item.slides.findIndex(slide => slide.id === target.source?.slideId);
  if (block < 0) throw new Error('The source slide is no longer available');
  const opened = await api.window.openSongEditor({
    songId: item.song,
    block,
    from: {serviceId: service.service.id, itemId: item.id},
  });
  if (!opened.ok) throw new Error('The song editor could not open');
}

/** App's existing editor binding, guarded navigation, and text-import surface. */
export interface PrepActions {
  readonly prep: PrepBinding | undefined;
  readonly imported: boolean;
  readonly editingSong: boolean;
  readonly canImport: boolean;
  readonly importText: (
    source: 'file' | 'clipboard' | 'powerpoint' | 'powerpoint-images',
  ) => void;
  /** 새 곡: opens 준비 and makes a song, as the library's plus does. */
  readonly newSong: () => void;
  readonly openSong: (songId: SongId, position?: number) => void;
  readonly onShowInLibrary: (songId: SongId) => void;
  readonly onOpenPrep: (
    itemId: string,
    position?: number,
    target?: 'settings',
  ) => void;
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
  const [importSource, setImportSource] = useState<
    'file' | 'clipboard' | 'powerpoint' | 'powerpoint-images' | null
  >(null);
  const closeImport = useCallback(() => setImportSource(null), []);
  const prepSelection = usePrepSelection();
  const editorControls = useRef<SongEditorWindowModel | null>(null);
  const slides = useSlidesEditor(session.api, session.report, {
    beforeOpen: open =>
      session.editor ? session.editor.requestLeave(open) : open(),
    positionOf: target => {
      const selected = session.items?.getSnapshot();
      const item = selected?.item;
      return item?.id === target.itemId && isItemOfKind(item, 'slides')
        ? contentPosition(item, selected?.position)
        : (selected?.position ?? 0);
    },
    onOpened: target => {
      prepSelection.clear();
      session.editor?.open(null);
      openItem(target.itemId);
      session.items?.show(target);
      onWorkspace('prep');
    },
  });
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
    onWorkspace('prep');
    prepSelection.openSong(songId, position);
  };
  const importText = (
    source: 'file' | 'clipboard' | 'powerpoint' | 'powerpoint-images',
  ): void => {
    if (session.api === undefined || importSource !== null) return;
    session.startEditor();
    setImportSource(source);
  };
  const newSong = (): void => {
    if (session.api === undefined) return;
    songOpen.current++;
    // NOTE(0913vision): The question about an unsaved song opens where the
    // command was given; 준비 opens only once it is answered.
    const create = (): void => {
      session.startEditor('manual');
      onWorkspace('prep');
      prepSelection.clear();
      session.editor?.openNew();
    };
    if (session.editor === undefined) create();
    else session.editor.requestLeave(create);
  };
  const imported = useSyncExternalStore(
    session.editor?.subscribe ?? noEditorSubscription,
    () => session.editor?.getSnapshot().imported ?? false,
  );
  const editingSong = useSyncExternalStore(
    session.editor?.subscribe ?? noEditorSubscription,
    () => session.editor?.getSnapshot().session != null,
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
  const onOpenPrep = (
    itemId: string,
    position?: number,
    target?: 'settings',
  ): void => {
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
      if (target === 'settings') {
        slides.close();
        if (view.serviceId !== null) {
          session.items?.show({serviceId: view.serviceId, itemId});
        }
        return;
      }
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
      const row = view.rows.find(row => row.id === itemId);
      if (view.serviceId !== null && row?.kind === 'bible') {
        slides.close();
        session.items?.show({serviceId: view.serviceId, itemId});
        session.items?.selectPosition(position ?? 0);
        return;
      }
      if (view.serviceId !== null && row?.kind === 'slides') {
        session.items?.show({serviceId: view.serviceId, itemId});
        session.items?.selectPosition(position ?? 0);
        session.api?.slidesEditor
          .open({
            serviceId: createServiceId(view.serviceId),
            itemId: createServiceItemId(itemId),
          })
          .catch((error: unknown) =>
            console.error('Could not open slides', error),
          );
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
            controls: editorControls,
            slides,
            onNewSong: newSong,
            selectionRequest: prepSelection.request,
            onSelectionHandled: prepSelection.handled,
            onServiceItemOpen: clearSelection,
            onImportedSave: openSong,
          }
        : undefined,
    imported: workspace === 'prep' && imported,
    editingSong: workspace === 'prep' && (editingSong || slides.draft !== null),
    canImport: session.api !== undefined && importSource === null,
    importText,
    newSong,
    openSong,
    onShowInLibrary,
    onOpenPrep,
    importSurface: (
      <>
        {session.api && session.editor ? (
          <InlineSongController
            store={session.editor}
            api={session.api}
            report={session.report}
            controls={editorControls}
            beforeLeave={slides.requestLeave}
            onOpen={target => {
              prepSelection.clear();
              if (target.from !== undefined) {
                openItem(target.from.itemId);
                session.items?.show(target.from);
                session.items?.selectPosition(target.block ?? 0);
              }
              onWorkspace('prep');
            }}
          />
        ) : null}
        {session.api && importSource === 'powerpoint-images' ? (
          <PowerPointImagesFlow
            api={session.api}
            onDone={closeImport}
            onProblem={session.report}
          />
        ) : session.api && session.editor && importSource === 'powerpoint' ? (
          <PowerPointImportFlow
            api={session.api}
            store={session.editor}
            onDone={closeImport}
            onEdit={() => {
              clearSelection();
              onWorkspace('prep');
            }}
            onProblem={session.report}
          />
        ) : session.api &&
          session.editor &&
          importSource !== null &&
          importSource !== 'powerpoint' &&
          importSource !== 'powerpoint-images' ? (
          <TextImportFlow
            api={session.api}
            store={session.editor}
            source={importSource}
            onDone={closeImport}
            onEdit={() => {
              clearSelection();
              onWorkspace('prep');
            }}
            onProblem={session.report}
          />
        ) : null}
      </>
    ),
  };
}
