import {useEffect, useEffectEvent, useState, type JSX} from 'react';
import type {SongId} from '@shared/schema/ids';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelMeta,
  PanelTabs,
  PanelTools,
} from '@renderer/ui/Panel';
import {TextField} from '@renderer/ui/TextField';
import {LibraryList} from './LibraryList';
import {useLibrary, type LibraryApi, type LibrarySelection} from './useLibrary';
import styles from './LibraryPanel.module.css';

/** A one-shot host request, acknowledged after dispatch so remount cannot replay it. */
export type LibrarySelectionRequest =
  {readonly kind: 'open'; readonly songId: SongId} | {readonly kind: 'clear'};

export interface LibraryPanelProps {
  readonly api: LibraryApi;
  /** Opens the editor; after creation the host focuses its title field. */
  readonly onOpenSong: (selection: LibrarySelection) => void;
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
  onProblem,
  selectionRequest,
  onSelectionHandled,
}: LibraryPanelProps): JSX.Element {
  const library = useLibrary(api, onOpenSong, onProblem);
  const selectRequested = useEffectEvent(
    (request: LibrarySelectionRequest): void => {
      if (request.kind === 'clear') {
        library.clearSelection();
      } else {
        library.setQuery('');
        library
          .open(request.songId)
          .catch((cause: unknown) =>
            console.error('Requested library selection failed:', cause),
          );
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
  const candidate = library.songs.find(song => song.id === deleting);
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
          <PanelMeta>{library.songs.length}</PanelMeta>
          <PanelActions>
            <IconButton
              icon="plus"
              label="새 곡"
              disabled={library.busy || library.loading}
              onClick={() => {
                library.create().catch(() => library.report('create'));
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
          <div className={styles.list} aria-busy={library.loading}>
            <LibraryList
              rows={library.visible}
              selected={library.selected}
              onSelect={id => {
                library.open(id).catch(() => library.report('open'));
              }}
              onContextMenu={(event, id) => {
                event.preventDefault();
                setMenu({
                  id,
                  anchor: {
                    kind: 'point',
                    point: {x: event.clientX, y: event.clientY},
                  },
                });
              }}
            />
          </div>
        </PanelBody>
      </Panel>
      {menu && menuSong ? (
        <Menu
          label="곡 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={[
            {
              kind: 'item',
              id: 'delete',
              label: '삭제',
              icon: 'trash',
              danger: true,
              disabled: library.busy || menuSong.access === 'readOnly',
              title:
                menuSong.access === 'readOnly'
                  ? '읽기 전용 곡입니다'
                  : undefined,
              onSelect: () => {
                setDeleting(menuSong.id);
                setMenu(null);
              },
            },
          ]}
        />
      ) : null}
      {candidate ? (
        <AlertDialog
          icon="song"
          title={`‘${candidate.title}’ 곡을 삭제할까요?`}
          meta={
            candidate.usedBy.length > 0
              ? [`예배 순서 ${candidate.usedBy.length}곳에서 씀`]
              : undefined
          }
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
