import {EmptyState} from '@renderer/ui/EmptyState';
import {
  NEWER_FILE_REASON,
  NOTHING_TO_UNDO,
  NOTHING_TO_REDO,
} from '@renderer/platform/problemReasons';
import {deleteSelection} from '@renderer/ui/useSelectionDelete';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type JSX,
} from 'react';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {mediaLoops} from '@core/media/mediaEndRule';
import {createServiceItemId, type MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {RenameDialog} from '@renderer/ui/RenameDialog';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {focusHistorySurface} from '@renderer/ui/focusHistorySurface';
import {MEDIA_LIMITS} from '@core/schema/mediaList';
import {useLive} from '@renderer/session/live';
import {sendMediaOutput} from '@renderer/session/itemOutput';
import {useShow} from '@renderer/session/showStore';
import {useOrderFull} from '@renderer/session/orderFull';
import {ORDER_FULL_REASON} from '@renderer/session/serviceOrderEdits';
import {quickAddBefore} from '@core/services/quickAddPosition';
import {useServiceOrderEditing} from '@renderer/session/useServiceOrderEditing';
import {newMediaItem} from '@core/services/quickAddMedia';
import {
  Button,
  MediaTile,
  Panel,
  PanelActions,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTabs,
  Slider,
} from '@renderer/ui';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {
  UNNAMED_PLAYLIST,
  chosenPlaylist,
  durationText,
  mediaEntries,
  totalText,
  type ChosenPlaylist,
  type MediaEntry,
} from './mediaEntries';
import {useMediaImportCompletion, useMediaView} from './MediaViewProvider';
import {VirtualMediaGrid} from './VirtualMediaGrid';
import {writeMediaDrag} from './mediaDrag';
import {useMediaImportAction} from './useMediaImportAction';
import styles from './MediaView.module.css';
import {mediaTileMenuEntries, type MediaTileActions} from './mediaMenuEntries';

/** The fewest and most grid columns the size slider sets. */
export const MIN_MEDIA_COLUMNS = 2;
export const MAX_MEDIA_COLUMNS = 8;
export const DEFAULT_MEDIA_COLUMNS = 5;

export const UNNAMED_MEDIA = '이름 없는 미디어';

export interface MediaViewProps {
  readonly workspace?: 'show' | 'prep';
  /** The workspace host merges problems into its one notification list. */
  readonly onProblem: (notice: Notice) => void;
  readonly onCollapse?: ((button: HTMLButtonElement) => void) | undefined;
}

interface OpenMenu {
  readonly entries: readonly MenuEntry[];
  readonly anchor: MenuAnchor;
}

function playlistRef(playlist: ChosenPlaylist) {
  return playlist.kind === 'media'
    ? ({kind: 'media', id: playlist.id} as const)
    : ({kind: 'audio', id: playlist.id} as const);
}

function nameOf(entry: MediaEntry): string {
  return entry.kind === 'copy'
    ? entry.job.fileName
    : entry.item.name || UNNAMED_MEDIA;
}

function EntryTile({
  entry,
  missing,
  live,
  selected,
  display,
}: {
  readonly entry: MediaEntry;
  readonly display: 'grid' | 'list';
  readonly missing: boolean;
  readonly live: boolean;
  readonly selected: boolean;
}): JSX.Element {
  if (entry.kind === 'copy') {
    return (
      <MediaTile
        name={nameOf(entry)}
        copying={entry.job.percent}
        view={display}
      />
    );
  }
  const {item, copying} = entry;
  const showsPicture = item.kind !== 'audio' && !missing;
  return (
    <MediaTile
      view={display}
      name={nameOf(entry)}
      picture={showsPicture ? thumbnailSrc(item.id) : undefined}
      duration={item.kind === 'image' ? undefined : durationText(item.duration)}
      loop={item.kind === 'video' && mediaLoops(item)}
      copying={copying}
      missingFile={missing ? item.file : undefined}
      live={live}
      selected={selected}
      onDragStart={
        copying === undefined
          ? event => writeMediaDrag(event.dataTransfer, item.id)
          : undefined
      }
    />
  );
}

/**
 * The center of the media view in 준비 (spec 05, "Media view"): the list the
 * playlist panels chose, as a grid of tiles, 가져오기 into it with each file's
 * copy progress, and the size slider. In 준비, a click selects and a double
 * click outputs. In 진행, a click outputs without changing selection.
 * A missing file's tile opens 다시 연결.
 */
export function MediaView({
  onProblem,
  workspace = 'prep',
  onCollapse,
}: MediaViewProps): JSX.Element {
  const {library, view, choice, selected, select: setSelected} = useMediaView();
  const serviceId = useShow(state => state.serviceId);
  const serviceReadOnly = useShow(state => state.readOnly);
  const orderFull = useOrderFull();
  const orderEditing = useServiceOrderEditing(serviceId, onProblem);
  const addReason =
    serviceId === null
      ? '열린 예배 없음'
      : serviceReadOnly
        ? NEWER_FILE_REASON
        : orderFull
          ? ORDER_FULL_REASON
          : orderEditing.busy
            ? '예배 순서에 추가하는 중'
            : undefined;
  const imported = useMediaImportCompletion();
  const [columns, setColumns] = useState<number>();
  const [display, setDisplay] = useState<'grid' | 'list'>('grid');
  const displayChanged = useRef(false);
  const columnsChanged = useRef(false);
  useEffect(() => {
    let active = true;
    window.llp?.ui
      .get()
      .then(state => {
        if (
          active &&
          !displayChanged.current &&
          state.mediaBrowser?.view !== undefined
        ) {
          setDisplay(state.mediaBrowser.view);
        }
        if (
          active &&
          !columnsChanged.current &&
          state.mediaBrowser?.columns !== undefined
        ) {
          setColumns(state.mediaBrowser.columns);
        }
      })
      .catch((error: unknown) =>
        console.error('Could not read media view size', error),
      );
    return () => {
      active = false;
    };
  }, []);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const menuTarget = useRef<HTMLElement | undefined>(undefined);
  const [renaming, setRenaming] = useState<MediaItem | null>(null);
  const renameAfterMenu = useMenuHandoff(menu !== null, setRenaming);
  const deleteItem = (
    item: MediaItem,
    target: HTMLElement | undefined,
  ): void => {
    deleteSelection(
      1,
      () =>
        view.document?.access === 'editable' &&
        view.document.value.items.some(value => value.id === item.id),
      () => {
        focusHistorySurface(
          target?.closest<HTMLElement>('section[aria-label="미디어 보기"]') ??
            null,
        );
        library
          .deleteMedia(item.id, item.name || UNNAMED_MEDIA)
          .catch((cause: unknown) =>
            console.error('Deleting media failed:', cause),
          );
      },
    );
  };
  const deleteAfterMenu = useMenuHandoff<{
    item: MediaItem;
    target: HTMLElement | undefined;
  }>(menu !== null, ({item, target}) => deleteItem(item, target));
  const askToDelete = (item: MediaItem): void => {
    deleteAfterMenu({item, target: menuTarget.current});
    setMenu(null);
  };
  const liveId = useLive(state => state.state?.layers.media?.mediaId);
  const entries = useMemo(() => mediaEntries(view, choice), [view, choice]);
  const playlist = chosenPlaylist(view.document, choice);
  const title =
    playlist === null ? '모든 미디어' : playlist.name || UNNAMED_PLAYLIST;
  const items = entries.flatMap(entry =>
    entry.kind === 'media' ? [entry.item] : [],
  );
  const index = entries.findIndex(({id}) => id === selected);
  const missing = (entry: MediaEntry): boolean =>
    entry.kind === 'media' && view.missing.has(entry.item.id);

  const relink = (mediaId: MediaId, name: string): void => {
    library.relink(mediaId, name).catch((cause: unknown) => {
      console.error('Media relink failed:', cause);
    });
  };
  const activate = (at: number): void => {
    const entry = entries[at];
    if (entry === undefined || entry.kind === 'copy') return;
    if (missing(entry)) relink(entry.item.id, nameOf(entry));
    else if (workspace === 'show') output(at);
    else setSelected(entry.id);
  };
  const output = (at: number): void => {
    const entry = entries[at];
    if (
      entry?.kind !== 'media' ||
      entry.item.kind === 'audio' ||
      entry.copying !== undefined ||
      missing(entry)
    ) {
      return;
    }
    try {
      sendMediaOutput({
        mediaId: entry.item.id,
        loop: mediaLoops(entry.item),
        itemId: `media:${entry.item.id}`,
        title: nameOf(entry),
      });
    } catch (cause: unknown) {
      console.error('Media output failed:', cause);
      onProblem({
        key: 'media-view:output',
        kind: 'warning',
        icon: 'warning',
        title: '미디어 내보내기 실패',
        time: noticeTime(),
      });
    }
  };
  const duplicateMedia = (mediaId: MediaId): void => {
    library
      .duplicateMedia(mediaId)
      .then(copyId => {
        if (copyId !== null) setSelected(copyId);
      })
      .catch((cause: unknown) => {
        console.error('Copying media failed:', cause);
      });
  };
  const actions = (entry: MediaEntry): MediaTileActions => ({
    output: () => output(entries.findIndex(row => row.id === entry.id)),
    missing: missing(entry),
    editable: view.document?.access === 'editable',
    inPlaylist: playlist !== null,
    audioPlaylist: playlist?.kind === 'audio',
    addReason,
    addToService: mediaId => {
      if (
        addReason !== undefined ||
        library.getSnapshot().missing.has(mediaId)
      ) {
        return;
      }
      const {rows, openItemId} = useShow.getState();
      const before = quickAddBefore(rows, openItemId);
      orderEditing.run((edits, id) =>
        edits.insertItem(
          id,
          newMediaItem(mediaId),
          before === null ? null : createServiceItemId(before),
        ),
      );
    },
    properties: setSelected,
    cancel: mediaId => {
      library.cancel(mediaId, nameOf(entry)).catch((cause: unknown) => {
        console.error('Stopping a media copy failed:', cause);
      });
    },
    relink: mediaId => relink(mediaId, nameOf(entry)),
    leave: mediaId => {
      if (playlist === null) return;
      library
        .removeFromPlaylist(playlist, mediaId, nameOf(entry))
        .catch((cause: unknown) => {
          console.error('Removing media from a playlist failed:', cause);
        });
    },
    duplicate: duplicateMedia,
    setProps: (id, change) => {
      library.updateProps(id, change).catch((cause: unknown) => {
        console.error('Changing media properties failed:', cause);
      });
    },
    remove: askToDelete,
    reveal: mediaId => library.reveal(mediaId),
    rename: renameAfterMenu,
  });
  const selectedItem =
    entries[index]?.kind === 'media' ? entries[index].item : undefined;
  const copyReason =
    view.document?.access === 'editable' ? undefined : NEWER_FILE_REASON;
  useWindowShortcuts([
    ...(['undo', 'redo'] as const).map(kind => ({
      id: `edit.${kind}`,
      context: 'service' as const,
      when: (event: KeyboardEvent) =>
        event.target instanceof Element &&
        event.target.closest('section[aria-label="미디어 보기"]') !== null,
      unavailable: () =>
        (kind === 'undo' ? library.canUndoDelete() : library.canRedoDelete())
          ? undefined
          : kind === 'undo'
            ? NOTHING_TO_UNDO
            : NOTHING_TO_REDO,
      run: () => library.historyDelete(kind),
    })),
    {
      id: 'edit.delete',
      when: event =>
        selectedItem !== undefined &&
        event.target instanceof Element &&
        event.target.closest(
          'section[aria-label="미디어 보기"] [role="listbox"]',
        ) !== null,
      unavailable: () => copyReason,
      run: event => {
        if (selectedItem && copyReason === undefined) {
          deleteItem(
            selectedItem,
            event.target instanceof HTMLElement ? event.target : undefined,
          );
        }
      },
    },
    {
      id: 'edit.duplicate',
      when: event =>
        selectedItem !== undefined &&
        event.target instanceof Element &&
        event.target.closest(`[aria-label="${CSS.escape(title)}"]`) !== null,
      unavailable: () => copyReason,
      run: () => {
        if (selectedItem !== undefined && copyReason === undefined) {
          duplicateMedia(selectedItem.id);
        }
      },
    },
  ]);
  const {
    reason: importReason,
    startImport,
    isPending,
  } = useMediaImportAction(view.document, async files => {
    const destination = playlist === null ? null : playlistRef(playlist);
    const jobs = await (files === undefined
      ? library.import(destination)
      : library.importFiles(files, destination));
    imported(jobs ?? [], choice);
  });
  const dragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect =
      importReason === undefined && !isPending() ? 'copy' : 'none';
  };
  const drop = (event: DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    if (importReason !== undefined || isPending()) return;
    const files: File[] = [];
    const count = Math.min(
      event.dataTransfer.files.length,
      MEDIA_LIMITS.importBatch,
    );
    for (let index = 0; index < count; index++) {
      const file = event.dataTransfer.files[index];
      if (file !== undefined) files.push(file);
    }
    if (files.length > 0) startImport(files);
  };
  return (
    <>
      <Panel label="미디어 보기" className={styles.panel}>
        <PanelHeader>
          <PanelTabs
            tabs={[{value: 'list', label: title}]}
            value="list"
            onChange={() => undefined}
          />
          <PanelActions>
            <Button
              aria-label="미디어 목록 보기"
              aria-pressed={display === 'list'}
              onClick={() => {
                const next = display === 'grid' ? 'list' : 'grid';
                displayChanged.current = true;
                setDisplay(next);
                window.llp?.ui.setMediaBrowser({view: next});
              }}
            >
              목록
            </Button>
            <Button
              icon="download"
              disabled={importReason !== undefined}
              title={importReason}
              onClick={() => startImport()}
            >
              가져오기
            </Button>
            {onCollapse === undefined ? null : (
              <Button
                icon="down"
                aria-label="미디어 접기"
                aria-expanded={true}
                data-media-toggle
                title="미디어 접기"
                onClick={event => onCollapse(event.currentTarget)}
              >
                접기
              </Button>
            )}
          </PanelActions>
        </PanelHeader>
        <PanelBody tab="list" className={styles.body}>
          {view.document !== null && entries.length === 0 ? (
            <div
              className={styles.emptyDrop}
              onDragOver={dragOver}
              onDrop={drop}
            >
              <EmptyState
                text="미디어 없음"
                action={
                  <Button
                    icon="download"
                    disabled={importReason !== undefined}
                    title={importReason}
                    onClick={() => startImport()}
                  >
                    가져오기
                  </Button>
                }
              />
            </div>
          ) : null}
          <VirtualMediaGrid
            workspace={workspace}
            onDragOver={dragOver}
            onDrop={drop}
            label={title}
            count={entries.length}
            ids={entries.map(entry => entry.id)}
            columns={columns ?? DEFAULT_MEDIA_COLUMNS}
            view={display}
            fitHeight={display === 'grid' && columns === undefined}
            selected={index < 0 ? undefined : index}
            onSelect={at => setSelected(entries[at]?.id ?? null)}
            onActivate={activate}
            onOutput={workspace === 'show' ? () => undefined : output}
            onMenu={(at, anchor) => {
              menuTarget.current = anchor.target;
              const entry = entries[at];
              if (entry !== undefined) setSelected(entry.id);
              const choices =
                entry === undefined
                  ? []
                  : mediaTileMenuEntries(entry, actions(entry));
              if (choices.length > 0) setMenu({entries: choices, anchor});
            }}
            tile={at => {
              const entry = entries[at];
              return entry === undefined ? null : (
                <EntryTile
                  key={entry.id}
                  entry={entry}
                  display={display}
                  missing={missing(entry)}
                  live={liveId === entry.id}
                  selected={selected === entry.id}
                />
              );
            }}
          />
        </PanelBody>
        <PanelFooter
          end={
            <Slider
              label="타일 크기"
              disabled={display === 'list'}
              title={display === 'list' ? '격자 보기에서 조절' : undefined}
              workspace={workspace}
              icon="grid"
              width="compact"
              min={MIN_MEDIA_COLUMNS}
              max={MAX_MEDIA_COLUMNS}
              step={1}
              value={
                MIN_MEDIA_COLUMNS +
                MAX_MEDIA_COLUMNS -
                (columns ?? DEFAULT_MEDIA_COLUMNS)
              }
              valueText={columns === undefined ? '자동 크기' : `${columns}열`}
              onChange={size => {
                const next = MIN_MEDIA_COLUMNS + MAX_MEDIA_COLUMNS - size;
                columnsChanged.current = true;
                setColumns(next);
                window.llp?.ui.setMediaBrowser({columns: next});
              }}
            />
          }
        >
          {totalText(items)}
        </PanelFooter>
      </Panel>
      {menu === null ? null : (
        <Menu
          context
          label="미디어 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={menu.entries}
        />
      )}
      {renaming === null ? null : (
        <RenameDialog
          title="미디어 이름 바꾸기"
          label="미디어 이름"
          name={renaming.name}
          rename={{
            validate: name =>
              name.trim() === ''
                ? '이름을 적어야 저장할 수 있습니다'
                : name.trim().length > MEDIA_LIMITS.name
                  ? `이름이 너무 깁니다`
                  : undefined,
            onClose: () => setRenaming(null),
            onCommit: name => library.rename(renaming.id, name),
          }}
        />
      )}
    </>
  );
}
