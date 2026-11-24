import {useEffect, useEffectEvent, useRef, useState, type JSX} from 'react';
import type {SongId} from '@core/schema/common/ids';
import {contentDeleteHistory} from '@renderer/platform/undo/contentDeleteHistory';
import {useUndoKeys} from '@renderer/platform/undo/useUndoKeys';
import {contextMenuAnchor} from '@renderer/ui/menus/contextMenu';
import {useReflow} from '@renderer/ui/panels/useReflow';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {Menu} from '@renderer/ui/menus/Menu';
import type {Notice} from '@renderer/ui/popups/notices';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelFooter,
  PanelTabs,
  PanelTools,
} from '@renderer/ui/panels/Panel';
import {TextField} from '@renderer/ui/fields/TextField';
import {useMenuHandoff} from '@renderer/ui/menus/useMenuHandoff';
import {RenameDialog} from '@renderer/ui/popups/RenameDialog';
import {SONG_TITLE_LIMIT} from '@core/songs';
import {songTitleReason} from './songTitleReason';
import {EmptyState} from '@renderer/ui/lists/EmptyState';
import {LibraryList} from './LibraryList';
import {useLibrary, type LibraryApi, type LibrarySelection} from './useLibrary';
import styles from './LibraryPanel.module.css';
import {libraryMenuEntries} from './libraryMenuEntries';
import {useLibraryServices} from './useLibraryServices';
import {useSongDelete, useSongDuplicateKey} from './useSongCommands';
import {type MenuAnchor} from '@renderer/ui/menus/menuModel';

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
  readonly navigating?: boolean | undefined;
  /** Opens the editor; after creation the host focuses its title field. */
  readonly onOpenSong: (selection: LibrarySelection) => void;
  readonly onSelectSong?: ((songId: SongId) => void) | undefined;
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
  navigating = false,
  onOpenSong,
  onSelectSong,
  onNewSong,
  beforeOpen,
  onProblem,
  selectionRequest,
  onSelectionHandled,
}: LibraryPanelProps): JSX.Element {
  const library = useLibrary(api, onOpenSong, onProblem);
  const serviceMenu = useLibraryServices(api, onProblem);
  const createSong = (): void => {
    if (onNewSong) onNewSong();
    else library.create().catch(() => library.report('create'));
  };
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
        createSong();
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
  const [renaming, setRenaming] = useState<SongId | null>(null);
  const renameAfterMenu = useMenuHandoff(menu !== null, setRenaming);
  const renamed = library.songs.find(song => song.id === renaming);
  const listArea = useRef<HTMLDivElement>(null);
  const history = contentDeleteHistory(api.content);
  useUndoKeys(listArea);
  useReflow(listArea, {
    ids: library.visible.map(row => row.song.id),
    selector: '[role="option"][data-value]',
    attribute: 'data-value',
    scope: 'library',
  });
  const deleteAfterMenu = useSongDelete({
    list: listArea,
    library,
    history,
    menuOpen: menu !== null,
  });
  useSongDuplicateKey({list: listArea, library, serviceBusy: serviceMenu.busy});
  const menuSong = library.songs.find(song => song.id === menu?.id);
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
              onClick={createSong}
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
                if (navigating) open(id);
                else {
                  library.select(id);
                  onSelectSong?.(id);
                }
              }}
              onOpen={open}
              onNavigate={library.select}
              onContextMenu={(event, id) => {
                event.preventDefault();
                library.select(id);
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
          context
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
            remove: () => deleteAfterMenu(menuSong),
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
          rename={{
            maxLength: SONG_TITLE_LIMIT,
            validate: value =>
              songTitleReason(value, renamed.id, library.songs),
            onClose: () => setRenaming(null),
            onCommit: title => library.rename(renamed.id, title),
          }}
        />
      ) : null}
    </>
  );
}
