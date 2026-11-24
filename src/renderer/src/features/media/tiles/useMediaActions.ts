import {useRef, useState} from 'react';
import {mediaLoops} from '@core/media';
import type {MediaId} from '@core/schema/common/ids';
import type {MediaItem} from '@core/schema/media/mediaList';
import {mediaItem} from '@renderer/platform/documents/media';
import {
  insertNewItem,
  rowAfterSelected,
} from '@renderer/session/service/insertNewItem';
import {sendMediaOutput} from '@renderer/session/show/itemOutput';
import {useOrderAddReason} from '@renderer/session/service/orderReasons';
import {deleteSelection} from '@renderer/ui/lists/deleteSelection';
import {focusHistorySurface} from '@renderer/ui/lists/focusHistorySurface';
import type {MenuEntry, MenuAnchor} from '@renderer/ui/menus/menuModel';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';
import {useMenuHandoff} from '@renderer/ui/menus/useMenuHandoff';
import {chosenPlaylist, mediaName, type MediaEntry} from '../mediaEntries';
import {mediaTileMenuEntries, type MediaTileActions} from './mediaMenuEntries';
import {useMediaView} from '../MediaViewProvider';
import {newMediaItem} from '../newMediaItem';
import type {useMediaPicks} from './useMediaPicks';

interface OpenMenu {
  readonly entries: readonly MenuEntry[];
  readonly anchor: MenuAnchor;
}

/** The name a tile shows: the file being copied, or the media's own. */
export function entryName(entry: MediaEntry): string {
  return entry.kind === 'copy' ? entry.job.fileName : mediaName(entry.item);
}

/**
 * What the tiles of the media view do: output, 다시 연결, 예배 순서에 넣기,
 * copy, delete, and the tile menu with its 이름 바꾸기.
 */
export function useMediaActions({
  entries,
  picks,
  workspace,
  onProblem,
}: {
  readonly entries: readonly MediaEntry[];
  readonly picks: ReturnType<typeof useMediaPicks>;
  readonly workspace: 'show' | 'prep';
  readonly onProblem: (notice: Notice) => void;
}) {
  const {library, view, choice, select: setSelected} = useMediaView();
  const addReason = useOrderAddReason();
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const menuTarget = useRef<HTMLElement | undefined>(undefined);
  const [renaming, setRenaming] = useState<MediaItem | null>(null);
  const renameAfterMenu = useMenuHandoff(menu !== null, setRenaming);
  const playlist = chosenPlaylist(view.document, choice);
  const missing = (entry: MediaEntry): boolean =>
    entry.kind === 'media' && view.missing.has(entry.item.id);

  const deleteItem = (
    item: MediaItem,
    target: HTMLElement | undefined,
  ): void => {
    const deleted = picks.picked.has(item.id)
      ? (view.document?.value.items ?? []).filter(({id}) =>
          picks.picked.has(id),
        )
      : [item];
    deleteSelection(
      deleted.length,
      () =>
        view.document?.access === 'editable' &&
        view.document.value.items.some(value => value.id === item.id),
      () => {
        focusHistorySurface(
          target?.closest<HTMLElement>('section[aria-label="미디어 보기"]') ??
            null,
        );
        picks.clear();
        for (const media of deleted) {
          library
            .deleteMedia(media.id, mediaName(media))
            .catch((cause: unknown) =>
              console.error('Deleting media failed:', cause),
            );
        }
      },
    );
  };
  const deleteAfterMenu = useMenuHandoff<{
    item: MediaItem;
    target: HTMLElement | undefined;
  }>(menu !== null, ({item, target}) => deleteItem(item, target));
  const relink = (mediaId: MediaId, name: string): void => {
    library.relink(mediaId, name).catch((cause: unknown) => {
      console.error('Media relink failed:', cause);
    });
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
        title: entryName(entry),
      });
    } catch (cause: unknown) {
      console.error('Media output failed:', cause);
      onProblem(warningNotice('media-view:output', '미디어 내보내기 실패'));
    }
  };
  const activate = (at: number): void => {
    const entry = entries[at];
    if (entry === undefined || entry.kind === 'copy') return;
    if (missing(entry)) relink(entry.item.id, entryName(entry));
    else if (workspace === 'show') output(at);
    else picks.select(entry.id);
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
  const tileActions = (entry: MediaEntry): MediaTileActions => ({
    output: () => output(entries.findIndex(row => row.id === entry.id)),
    missing: missing(entry),
    editable: view.document?.access === 'editable',
    inPlaylist: playlist !== null,
    audioPlaylist: playlist?.kind === 'audio',
    addReason,
    addToService:
      workspace === 'show'
        ? undefined
        : mediaId => {
            if (
              addReason !== undefined ||
              library.getSnapshot().missing.has(mediaId)
            ) {
              return;
            }
            const media = mediaItem(mediaId);
            if (media === undefined) return;
            insertNewItem(newMediaItem(media), rowAfterSelected(), {
              report: onProblem,
            });
          },
    properties: setSelected,
    cancel: mediaId => {
      library.cancel(mediaId, entryName(entry)).catch((cause: unknown) => {
        console.error('Stopping a media copy failed:', cause);
      });
    },
    relink: mediaId => relink(mediaId, entryName(entry)),
    leave: mediaId => {
      if (playlist === null) return;
      library
        .removeFromPlaylist(playlist, mediaId, entryName(entry))
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
    remove: item => {
      deleteAfterMenu({item, target: menuTarget.current});
      setMenu(null);
    },
    reveal: mediaId => library.reveal(mediaId),
    rename: renameAfterMenu,
  });
  /** Opens the menu of tile `at`, selecting it unless it is one of the picks. */
  const openMenu = (at: number, anchor: MenuAnchor): void => {
    menuTarget.current = anchor.target;
    const entry = entries[at];
    if (entry !== undefined && !picks.picked.has(entry.id)) {
      picks.select(entry.id);
    }
    const choices =
      entry === undefined
        ? []
        : mediaTileMenuEntries(entry, tileActions(entry));
    if (choices.length > 0) setMenu({entries: choices, anchor});
  };
  return {
    playlist,
    missing,
    menu,
    closeMenu: () => setMenu(null),
    renaming,
    closeRenaming: () => setRenaming(null),
    activate,
    output,
    openMenu,
    deleteItem,
    duplicateMedia,
  };
}
