import {useEffect, useRef, useState, type JSX, type MouseEvent} from 'react';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {IconButton} from '@renderer/ui/IconButton';
import {
  ListBox,
  ListGroup,
  ListRow,
  type GroupRename,
} from '@renderer/ui/ListRow';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelTabs,
} from '@renderer/ui/Panel';
import {
  UNNAMED_PLAYLIST,
  chosenPlaylist,
  type MediaListChoice,
} from './mediaEntries';
import {useMediaView} from './MediaViewProvider';
import styles from './MediaListPanels.module.css';

const ALL = 'all';

function keyOf(choice: MediaListChoice): string {
  return choice.kind === 'all' ? ALL : `${choice.kind}:${choice.id}`;
}

function choiceOf(key: string): MediaListChoice {
  const [kind, id] = key.split(':');
  if (id !== undefined && (kind === 'media' || kind === 'audio')) {
    return {kind, id};
  }
  return {kind: 'all'};
}

function anchorOf(event: MouseEvent<HTMLElement>, row: Element): MenuAnchor {
  return event.clientX === 0 &&
    event.clientY === 0 &&
    row instanceof HTMLElement
    ? {kind: 'element', element: row}
    : {kind: 'point', point: {x: event.clientX, y: event.clientY}};
}

// NOTE(0913vision): A playlist row's menu has 이름 바꾸기 and 삭제; renaming
// happens in the row, and deleting asks first.
function usePlaylistEditing(kind: 'media' | 'audio') {
  const {library, view} = useMediaView();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    readonly id: string;
    readonly anchor: MenuAnchor;
  } | null>(null);
  const pendingRename = useRef<string | null>(null);
  // NOTE(0913vision): Let Menu's passive cleanup restore its opener before
  // mounting the auto-focused field, whose blur would otherwise commit it.
  useEffect(() => {
    if (menu !== null || pendingRename.current === null) return;
    const id = pendingRename.current;
    pendingRename.current = null;
    setRenaming(id);
  }, [menu]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const playlistOf = (id: string | null) =>
    id === null ? null : chosenPlaylist(view.document, {kind, id});
  const editable = view.document?.access === 'editable';
  const renameOf = (id: string): GroupRename | undefined =>
    renaming === id
      ? {
          onCommit: name => {
            setRenaming(null);
            const playlist = playlistOf(id);
            if (playlist === null) return;
            library.renamePlaylist(playlist, name).catch((cause: unknown) => {
              console.error('Renaming a playlist failed:', cause);
            });
          },
          onCancel: () => setRenaming(null),
        }
      : undefined;
  const onContextMenu = (event: MouseEvent<HTMLElement>): void => {
    const row =
      event.target instanceof Element
        ? event.target.closest('[data-value]')
        : null;
    const key = row?.getAttribute('data-value') ?? '';
    if (row === null || !editable || !key.startsWith(`${kind}:`)) return;
    event.preventDefault();
    setMenu({id: key.slice(kind.length + 1), anchor: anchorOf(event, row)});
  };
  const menuPlaylist = playlistOf(menu?.id ?? null);
  const doomed = playlistOf(deleting);
  const overlays = (
    <>
      {menu !== null && menuPlaylist !== null ? (
        <Menu
          label="재생목록 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={[
            {
              kind: 'item',
              id: 'rename',
              label: '이름 바꾸기',
              icon: 'edit',
              onSelect: () => {
                pendingRename.current = menu.id;
                setMenu(null);
              },
            },
            {
              kind: 'item',
              id: 'delete',
              label: '삭제',
              icon: 'trash',
              danger: true,
              onSelect: () => {
                setDeleting(menu.id);
                setMenu(null);
              },
            },
          ]}
        />
      ) : null}
      {doomed === null ? null : (
        <AlertDialog
          icon={kind === 'media' ? 'film' : 'audio'}
          title={`‘${doomed.name || UNNAMED_PLAYLIST}’ 재생목록을 삭제할까요?`}
          meta={[`미디어 ${doomed.items.length}개는 모든 미디어에 남음`]}
          onCancel={() => setDeleting(null)}
          actions={[
            {
              label: '삭제',
              primary: true,
              onSelect: () => {
                library.deletePlaylist(doomed).then(
                  () => setDeleting(null),
                  (cause: unknown) => {
                    console.error('Deleting a playlist failed:', cause);
                  },
                );
              },
            },
          ]}
        />
      )}
    </>
  );
  return {renameOf, onContextMenu, overlays, startRename: setRenaming};
}

function useCreate(kind: 'media' | 'audio', onCreated: (id: string) => void) {
  const {library, view, choose} = useMediaView();
  const [creating, setCreating] = useState(false);
  const create = (): void => {
    setCreating(true);
    library
      .createPlaylist(kind)
      .then(id => {
        if (id === null) return;
        choose({kind, id});
        onCreated(id);
      })
      .catch((cause: unknown) => {
        console.error('Creating a playlist failed:', cause);
      })
      .finally(() => {
        setCreating(false);
      });
  };
  const disabledReason = creating
    ? '재생목록 만드는 중'
    : view.document === null
      ? '미디어 불러오는 중'
      : view.document.access === 'readOnly'
        ? '읽기 전용 미디어 목록'
        : undefined;
  return {create, disabledReason};
}

/**
 * The 미디어 panel of the media view (spec 05, "Media view"): 보관함 with 모든
 * 미디어, and the 재생목록 group with each playlist and its count. 새 재생목록
 * adds one, shows it, and names it in its row; a playlist's menu renames or
 * deletes it.
 */
export function MediaListsPanel(): JSX.Element {
  const {view, choice, choose} = useMediaView();
  const editing = usePlaylistEditing('media');
  const {create, disabledReason} = useCreate('media', editing.startRename);
  const items = view.document?.value.items.length ?? 0;
  const playlists = view.document?.value.playlists ?? [];
  return (
    <Panel label="미디어" className={styles.panel}>
      <PanelHeader>
        <PanelTabs
          tabs={[{value: 'media', label: '미디어'}]}
          value="media"
          onChange={() => undefined}
        />
        <PanelActions>
          <IconButton
            icon="plus"
            label="새 재생목록"
            disabled={disabledReason !== undefined}
            title={disabledReason}
            onClick={create}
          />
        </PanelActions>
      </PanelHeader>
      <PanelBody tab="media" variant="list">
        <div className={styles.lists} onContextMenu={editing.onContextMenu}>
          <ListBox
            label="미디어 목록"
            selected={choice.kind === 'audio' ? undefined : keyOf(choice)}
            onSelect={key => choose(choiceOf(key))}
          >
            <ListGroup label="보관함">
              <ListRow
                value={ALL}
                title="모든 미디어"
                icon="grid"
                meta={String(items)}
              />
            </ListGroup>
            <ListGroup label="재생목록">
              {playlists.map(playlist => (
                <ListRow
                  key={playlist.id}
                  value={keyOf({kind: 'media', id: playlist.id})}
                  title={playlist.name || UNNAMED_PLAYLIST}
                  icon="film"
                  meta={String(playlist.items.length)}
                  rename={editing.renameOf(playlist.id)}
                />
              ))}
            </ListGroup>
          </ListBox>
        </div>
      </PanelBody>
      {editing.overlays}
    </Panel>
  );
}

/**
 * The 오디오 panel of the media view: each audio playlist and its count. 새
 * 오디오 재생목록 adds one, shows it, and names it in its row; a playlist's
 * menu renames or deletes it.
 */
export function AudioListsPanel(): JSX.Element {
  const {view, choice, choose} = useMediaView();
  const editing = usePlaylistEditing('audio');
  const {create, disabledReason} = useCreate('audio', editing.startRename);
  const playlists = view.document?.value.audioPlaylists ?? [];
  return (
    <Panel label="오디오" className={styles.panel}>
      <PanelHeader>
        <PanelTabs
          tabs={[{value: 'audio', label: '오디오'}]}
          value="audio"
          onChange={() => undefined}
        />
        <PanelActions>
          <IconButton
            icon="plus"
            label="새 오디오 재생목록"
            disabled={disabledReason !== undefined}
            title={disabledReason}
            onClick={create}
          />
        </PanelActions>
      </PanelHeader>
      <PanelBody tab="audio" variant="list">
        <div className={styles.lists} onContextMenu={editing.onContextMenu}>
          <ListBox
            label="오디오 재생목록"
            selected={choice.kind === 'audio' ? keyOf(choice) : undefined}
            onSelect={key => choose(choiceOf(key))}
          >
            {playlists.map(playlist => (
              <ListRow
                key={playlist.id}
                value={keyOf({kind: 'audio', id: playlist.id})}
                title={playlist.name || UNNAMED_PLAYLIST}
                icon="audio"
                meta={String(playlist.items.length)}
                rename={editing.renameOf(playlist.id)}
              />
            ))}
          </ListBox>
        </div>
      </PanelBody>
      {editing.overlays}
    </Panel>
  );
}
