import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {deleteSelection} from '@renderer/ui/deleteSelection';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {useRef, useState, type JSX} from 'react';
import {useReflow} from '@renderer/ui/useReflow';
import {focusHistorySurface} from '@renderer/ui/focusHistorySurface';
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
import {playlistMenuEntries} from './mediaMenuEntries';
import {
  contextMenuAnchor,
  isContextMenuKey,
  takeMenuKey,
  type ContextMenuEvent,
} from '@renderer/ui/contextMenu';

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

/** The id of the playlist row that holds the focus, if the key came from one. */
function focusedPlaylist(
  event: KeyboardEvent,
  kind: 'media' | 'audio',
): string | undefined {
  const row =
    event.target instanceof Element
      ? event.target.closest('[data-value]')
      : null;
  const key = row?.getAttribute('data-value') ?? '';
  return key.startsWith(`${kind}:`) ? key.slice(kind.length + 1) : undefined;
}

function usePlaylistEditing(kind: 'media' | 'audio') {
  const {library, view, choose} = useMediaView();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    readonly id: string;
    readonly anchor: MenuAnchor;
  } | null>(null);
  const renameAfterMenu = useMenuHandoff(menu !== null, setRenaming);
  const playlistOf = (id: string | null) =>
    id === null ? null : chosenPlaylist(view.document, {kind, id});
  const editable = view.document?.access === 'editable';
  const remove = (id: string, target: HTMLElement | undefined): void => {
    const playlist = playlistOf(id);
    deleteSelection(
      playlist ? 1 : 0,
      () => editable,
      () => {
        if (!playlist) return;
        focusHistorySurface(
          target?.closest<HTMLElement>('[data-playlist-history]') ?? null,
        );
        library
          .deletePlaylist(playlist)
          .catch((cause: unknown) =>
            console.error('Deleting a playlist failed:', cause),
          );
      },
    );
  };
  const deleteAfterMenu = useMenuHandoff<{
    id: string;
    target: HTMLElement | undefined;
  }>(menu !== null, ({id, target}) => remove(id, target));
  const renameOf = (id: string): GroupRename | undefined =>
    renaming === id
      ? {
          onCommit: name => {
            const playlist = playlistOf(id);
            return playlist === null
              ? false
              : library.renamePlaylist(playlist, name);
          },
          onClose: () => setRenaming(null),
        }
      : undefined;
  const onContextMenu = (event: ContextMenuEvent): void => {
    if (!('clientX' in event) && !isContextMenuKey(event)) return;
    const row =
      event.target instanceof Element
        ? event.target.closest('[data-value]')
        : null;
    const key = row?.getAttribute('data-value') ?? '';
    if (row === null || !key.startsWith(`${kind}:`)) return;
    if ('clientX' in event) {
      event.preventDefault();
      event.stopPropagation();
    } else {
      takeMenuKey(event);
    }
    choose(choiceOf(key));
    setMenu({id: key.slice(kind.length + 1), anchor: contextMenuAnchor(event)});
  };
  const duplicate = (id: string): void => {
    const playlist = playlistOf(id);
    if (playlist === null || !editable) return;
    library
      .duplicatePlaylist(playlist)
      .then(copyId => {
        if (copyId !== null) choose({kind, id: copyId});
      })
      .catch((cause: unknown) => {
        console.error('Copying a playlist failed:', cause);
      });
  };
  useWindowShortcuts([
    {
      id: 'edit.delete',
      when: event => focusedPlaylist(event, kind) !== undefined,
      unavailable: () => (editable ? undefined : NEWER_FILE_REASON),
      run: event => {
        const id = focusedPlaylist(event, kind);
        if (id !== undefined) {
          remove(
            id,
            event.target instanceof HTMLElement ? event.target : undefined,
          );
        }
      },
    },
    {
      id: 'edit.duplicate',
      when: event => focusedPlaylist(event, kind) !== undefined,
      unavailable: () => (editable ? undefined : NEWER_FILE_REASON),
      run: event => {
        const id = focusedPlaylist(event, kind);
        if (id !== undefined) duplicate(id);
      },
    },
  ]);
  const menuPlaylist = playlistOf(menu?.id ?? null);
  const overlays = (
    <>
      {menu !== null && menuPlaylist !== null ? (
        <Menu
          context
          label="재생목록 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={playlistMenuEntries(editable, () => duplicate(menu.id)).map(
            entry => {
              if (entry.kind !== 'item') return entry;
              if (entry.id === 'rename') {
                return {
                  ...entry,
                  onSelect: () => {
                    renameAfterMenu(menu.id);
                    setMenu(null);
                  },
                };
              }
              if (entry.id === 'delete') {
                return {
                  ...entry,
                  onSelect: () => {
                    deleteAfterMenu({id: menu.id, target: menu.anchor.target});
                    setMenu(null);
                  },
                };
              }
              return entry;
            },
          )}
        />
      ) : null}
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
        ? NEWER_FILE_REASON
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
  const items =
    view.document?.value.items.filter(item => item.internal !== true).length ??
    0;
  const playlists = view.document?.value.playlists ?? [];
  const list = useRef<HTMLDivElement>(null);
  useReflow(list, {
    ids: [
      ALL,
      ...playlists.map(playlist => keyOf({kind: 'media', id: playlist.id})),
    ],
    selector: '[role="option"][data-value]',
    attribute: 'data-value',
    scope: 'media-playlists',
  });
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
        <div
          ref={list}
          data-playlist-history="media"
          className={styles.lists}
          onContextMenu={editing.onContextMenu}
          onKeyDown={editing.onContextMenu}
        >
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
  const list = useRef<HTMLDivElement>(null);
  useReflow(list, {
    ids: playlists.map(playlist => keyOf({kind: 'audio', id: playlist.id})),
    selector: '[role="option"][data-value]',
    attribute: 'data-value',
    scope: 'audio-playlists',
  });
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
        <div
          ref={list}
          data-playlist-history="audio"
          className={styles.lists}
          onContextMenu={editing.onContextMenu}
          onKeyDown={editing.onContextMenu}
        >
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
