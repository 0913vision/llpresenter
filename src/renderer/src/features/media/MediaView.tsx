import {EmptyState} from '@renderer/ui/EmptyState';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type JSX,
} from 'react';
import {thumbnailUrl} from '@contracts/ipc/mediaUrls';
import {mediaLoops} from '@core/media/mediaEndRule';
import type {MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import type {MediaUses} from '@core/schema/mediaUses';
import {RenameDialog} from '@renderer/ui/RenameDialog';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {withinLookupTimeout} from '@renderer/session/showOutput';
import {USAGE_LABEL, USAGE_UNAVAILABLE} from '@renderer/ui/usageText';
import {MEDIA_LIMITS} from '@core/schema/mediaList';
import {sendLive, useLive} from '@renderer/session/live';
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
import {
  AlertDialog,
  AlertListRow,
  type AlertDialogProps,
} from '@renderer/ui/AlertDialog';
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
import {useMediaView} from './MediaViewProvider';
import {VirtualMediaGrid} from './VirtualMediaGrid';
import {writeMediaDrag} from './mediaDrag';
import {useMediaImportAction} from './useMediaImportAction';
import {MediaImportOptions} from './MediaImportOptions';
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
}: {
  readonly entry: MediaEntry;
  readonly missing: boolean;
  readonly live: boolean;
  readonly selected: boolean;
}): JSX.Element {
  if (entry.kind === 'copy') {
    return <MediaTile name={nameOf(entry)} copying={entry.job.percent} />;
  }
  const {item, copying} = entry;
  const showsPicture = item.kind !== 'audio' && !missing;
  return (
    <MediaTile
      name={nameOf(entry)}
      picture={showsPicture ? thumbnailUrl(item.id) : undefined}
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

const MEDIA_PLACES = [
  ['재생목록', 'playlists'],
  ['공지 세트', 'notices'],
  ['그래픽', 'graphics'],
  ['곡 배경', 'songBackgrounds'],
  ['예배 순서 항목', 'serviceItems'],
  ['항목 오버레이', 'itemOverlays'],
  ['테마', 'themes'],
  ['매크로', 'macros'],
] as const;

function mediaUsesList(uses: MediaUses): AlertDialogProps['list'] {
  const used = MEDIA_PLACES.filter(([, key]) => uses[key] > 0);
  if (used.length === 0) return undefined;
  return {
    label: USAGE_LABEL,
    children: used.map(([where, key]) => (
      <AlertListRow key={key} label={where} value={`${uses[key]}곳`} />
    )),
  };
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
  const [columns, setColumns] = useState(DEFAULT_MEDIA_COLUMNS);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [deleting, setDeleting] = useState<{
    readonly item: MediaItem;
    readonly uses: MediaUses | 'failed';
  } | null>(null);
  const [renaming, setRenaming] = useState<MediaItem | null>(null);
  const renameAfterMenu = useMenuHandoff(menu !== null, setRenaming);
  const lookup = useRef<AbortController | null>(null);
  useEffect(() => () => lookup.current?.abort(), []);
  const askToDelete = (item: MediaItem): void => {
    const api = window.llp;
    if (api === undefined) return;
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    withinLookupTimeout(() => api.media.uses({mediaId: item.id})).then(
      uses => {
        if (!controller.signal.aborted) setDeleting({item, uses});
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Could not look up where the media is used', cause);
        setDeleting({item, uses: 'failed'});
      },
    );
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
      sendLive({
        type: 'media.show',
        media: {
          mediaId: entry.item.id,
          loop: mediaLoops(entry.item),
          itemId: `media:${entry.item.id}`,
          title: nameOf(entry),
        },
      });
    } catch (cause: unknown) {
      console.error('Media output failed:', cause);
      onProblem({
        key: 'media-view:output',
        kind: 'warning',
        icon: 'warning',
        title: '미디어를 내보내지 못함',
        time: noticeTime(),
      });
    }
  };
  const actions = (entry: MediaEntry): MediaTileActions => ({
    missing: missing(entry),
    editable: view.document?.access === 'editable',
    inPlaylist: playlist !== null,
    audioPlaylist: playlist?.kind === 'audio',
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
    remove: askToDelete,
    reveal: mediaId => library.reveal(mediaId),
    rename: renameAfterMenu,
  });
  const {
    reason: importReason,
    startImport,
    isPending,
  } = useMediaImportAction(view.document, files => {
    const destination = playlist === null ? null : playlistRef(playlist);
    return files === undefined
      ? library.import(destination)
      : library.importFiles(files, destination);
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
            <MediaImportOptions onProblem={onProblem} />
            <Button
              icon="upload"
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
                    icon="upload"
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
            columns={columns}
            selected={index < 0 ? undefined : index}
            onSelect={at => setSelected(entries[at]?.id ?? null)}
            onActivate={activate}
            onOutput={workspace === 'show' ? () => undefined : output}
            onMenu={(at, anchor) => {
              const entry = entries[at];
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
              icon="grid"
              width="compact"
              min={MIN_MEDIA_COLUMNS}
              max={MAX_MEDIA_COLUMNS}
              step={1}
              value={MIN_MEDIA_COLUMNS + MAX_MEDIA_COLUMNS - columns}
              valueText={`${columns}열`}
              onChange={size =>
                setColumns(MIN_MEDIA_COLUMNS + MAX_MEDIA_COLUMNS - size)
              }
            />
          }
        >
          {totalText(items)}
        </PanelFooter>
      </Panel>
      {menu === null ? null : (
        <Menu
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
              name.trim() === '' ? '이름을 입력하세요' : undefined,
            onClose: () => setRenaming(null),
            onCommit: name => library.rename(renaming.id, name),
          }}
        />
      )}
      {deleting === null ? null : (
        <AlertDialog
          icon={deleting.item.kind === 'audio' ? 'audio' : 'film'}
          title={`‘${deleting.item.name || UNNAMED_MEDIA}’ 미디어를 삭제할까요?`}
          meta={[
            ...(deleting.uses === 'failed' ? [USAGE_UNAVAILABLE] : []),
            '파일은 그대로 남음',
          ]}
          list={
            deleting.uses === 'failed'
              ? undefined
              : mediaUsesList(deleting.uses)
          }
          onCancel={() => setDeleting(null)}
          actions={[
            {
              label: '삭제',
              primary: true,
              onSelect: () => {
                library
                  .deleteMedia(
                    deleting.item.id,
                    deleting.item.name || UNNAMED_MEDIA,
                  )
                  .then(
                    () => setDeleting(null),
                    (cause: unknown) => {
                      console.error('Deleting media failed:', cause);
                    },
                  );
              },
            },
          ]}
        />
      )}
    </>
  );
}
