import {useEffect, useEffectEvent, useRef, useState, type JSX} from 'react';
import type {LibrarySong} from '@core/schema/contentDocuments';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import type {SongId} from '@core/schema/ids';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {usageMeta} from '@renderer/ui/usageText';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelFooter,
  PanelTabs,
  PanelTools,
} from '@renderer/ui/Panel';
import {TextField} from '@renderer/ui/TextField';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {RenameDialog} from '@renderer/ui/RenameDialog';
import {SONG_TITLE_LIMIT} from '@core/songs/songTitle';
import {songTitleReason} from './songTitleReason';
import {EmptyState} from '@renderer/ui/EmptyState';
import {LibraryList} from './LibraryList';
import {useLibrary, type LibraryApi, type LibrarySelection} from './useLibrary';
import styles from './LibraryPanel.module.css';
import {libraryMenuEntries, songCopyReason} from './libraryMenuEntries';
import {useLibraryServices} from './useLibraryServices';
import {contextMenuAnchor} from '../../../ui/contextMenu';

/** A one-shot host request, acknowledged after dispatch so remount cannot replay it. */
export type LibrarySelectionRequest =
  | {
      readonly kind: 'open';
      readonly songId: SongId;
      readonly position?: number | undefined;
    }
  | {readonly kind: 'clear'}
  | {readonly kind: 'create'};

export interface LibraryPanelProps {
  readonly api: LibraryApi;
  /** Opens the editor; after creation the host focuses its title field. */
  readonly onOpenSong: (selection: LibrarySelection) => void;
  readonly onNewSong?: (() => void) | undefined;
  readonly beforeOpen?: ((open: () => void) => void) | undefined;
  /** The workspace host merges problems into its one notification list. */
  readonly onProblem: (notice: Notice) => void;
  readonly selectionRequest?: LibrarySelectionRequest | undefined;
  readonly onSelectionHandled?:
    ((request: LibrarySelectionRequest) => void) | undefined;
}

/** The independent library panel; the workspace host mounts it beside its editor. */
export function LibraryPanel({
  api,
  onOpenSong,
  onNewSong,
  beforeOpen,
  onProblem,
  selectionRequest,
  onSelectionHandled,
}: LibraryPanelProps): JSX.Element {
  const library = useLibrary(api, onOpenSong, onProblem);
  const serviceMenu = useLibraryServices(api, onProblem);
  const open = (id: SongId, position?: number): void => {
    const proceed = (): void => {
      library.open(id, position).catch(() => library.report('open'));
    };
    if (beforeOpen === undefined) proceed();
    else beforeOpen(proceed);
  };
  const selectRequested = useEffectEvent(
    (request: LibrarySelectionRequest): void => {
      if (request.kind === 'clear') {
        library.clearSelection();
      } else if (request.kind === 'create') {
        if (onNewSong) onNewSong();
        else library.create().catch(() => library.report('create'));
      } else {
        library.setQuery('');
        open(request.songId, request.position);
      }
      onSelectionHandled?.(request);
    },
  );
  useEffect(() => {
    if (selectionRequest) selectRequested(selectionRequest);
  }, [selectionRequest]);
  const [menu, setMenu] = useState<{id: SongId; anchor: MenuAnchor} | null>(
    null,
  );
  const [deleting, setDeleting] = useState<SongId | null>(null);
  const [renaming, setRenaming] = useState<SongId | null>(null);
  const renameAfterMenu = useMenuHandoff(menu !== null, setRenaming);
  const renamed = library.songs.find(song => song.id === renaming);
  const listArea = useRef<HTMLDivElement>(null);
  useWindowShortcuts([
    {
      id: 'edit.duplicate',
      when: event => copyTarget(event) !== undefined,
      unavailable: () => {
        const song = copyTarget();
        return song === undefined
          ? undefined
          : songCopyReason(song, library.busy || serviceMenu.busy);
      },
      run: event => {
        const song = copyTarget(event);
        if (
          song !== undefined &&
          songCopyReason(song, library.busy || serviceMenu.busy) === undefined
        ) {
          library.duplicate(song.id).catch(() => library.report('create'));
        }
      },
    },
  ]);
  const candidate = library.songs.find(song => song.id === deleting);
  const menuSong = library.songs.find(song => song.id === menu?.id);
  /** The song under the focus, or the selected song for a key-less ask. */
  const copyTarget = (event?: KeyboardEvent): LibrarySong | undefined => {
    const place =
      event?.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-value]')
        : null;
    if (place !== null) {
      return listArea.current?.contains(place) === true
        ? library.songs.find(song => song.id === place.dataset['value'])
        : undefined;
    }
    return event === undefined
      ? library.songs.find(song => song.id === library.selected)
      : undefined;
  };
  return (
    <>
      <Panel label="라이브러리" className={styles.panel}>
        <PanelHeader>
          <PanelTabs
            tabs={[{value: 'library', label: '라이브러리'}]}
            value="library"
            onChange={() => undefined}
          />
          <PanelActions>
            <IconButton
              icon="plus"
              label="새 곡"
              disabled={library.busy || library.loading}
              onClick={() => {
                if (onNewSong) onNewSong();
                else library.create().catch(() => library.report('create'));
              }}
            />
          </PanelActions>
        </PanelHeader>
        <PanelTools>
          <TextField
            icon="search"
            aria-label="라이브러리 검색"
            placeholder="제목, 가사, 초성"
            clearable
            block
            value={library.query}
            onChange={library.setQuery}
          />
        </PanelTools>
        <PanelBody tab="library" variant="flush" className={styles.body}>
          <div
            className={styles.list}
            aria-busy={library.loading}
            ref={listArea}
          >
            {library.visible.length === 0 &&
            (library.query === '' ? library.listed : library.searched) ? (
              <EmptyState
                text={library.query === '' ? '곡 없음' : '검색 결과 없음'}
              />
            ) : null}
            <LibraryList
              rows={library.visible}
              selected={library.selected}
              onSelect={id => {
                open(id);
              }}
              onContextMenu={(event, id) => {
                event.preventDefault();
                setMenu({
                  id,
                  anchor: contextMenuAnchor(event),
                });
              }}
            />
          </div>
        </PanelBody>
        <PanelFooter count={library.songs.length} />
      </Panel>
      {menu && menuSong ? (
        <Menu
          label="곡 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={libraryMenuEntries({
            song: menuSong,
            appendDisabledReason: serviceMenu.disabledReason,
            busy: library.busy || serviceMenu.busy,
            open: () => {
              open(menuSong.id);
            },
            append: () => {
              serviceMenu
                .append(menuSong.id)
                .catch((cause: unknown) =>
                  console.error('Could not append the library song:', cause),
                );
            },
            duplicate: () => {
              library
                .duplicate(menuSong.id)
                .catch(() => library.report('create'));
            },
            remove: () => setDeleting(menuSong.id),
            rename: () => renameAfterMenu(menuSong.id),
            reveal: () => api.library.revealSong(menuSong.id),
          })}
        />
      ) : null}
      {renamed ? (
        <RenameDialog
          title="곡 이름 바꾸기"
          label="곡 제목"
          name={renamed.title}
          maxLength={SONG_TITLE_LIMIT}
          rename={{
            validate: value =>
              songTitleReason(value, renamed.id, library.songs),
            onClose: () => setRenaming(null),
            onCommit: title => library.rename(renamed.id, title),
          }}
        />
      ) : null}
      {candidate ? (
        <AlertDialog
          icon="song"
          title={`‘${candidate.title}’ 곡을 삭제할까요?`}
          meta={usageMeta(candidate.usedBy.length, '예배')}
          onCancel={() => setDeleting(null)}
          actions={[
            {
              label: '삭제',
              primary: true,
              disabled: library.busy || candidate.access === 'readOnly',
              onSelect: () => {
                library.remove(candidate.id).then(
                  removed => {
                    if (removed) setDeleting(null);
                  },
                  () => library.report('delete'),
                );
              },
            },
          ]}
        />
      ) : null}
    </>
  );
}
