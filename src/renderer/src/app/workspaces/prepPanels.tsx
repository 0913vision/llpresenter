import {useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {parseServiceItemId, type SongId} from '@core/schema/ids';
import {
  DetailsPanel,
  type DetailsTarget,
} from '@renderer/features/service/details/DetailsPanel';
import {useItemEditor} from '@renderer/features/service/editor/useItemEditor';
import {PrepPalette} from '@renderer/features/service/items/PrepPalette';
import {openDeckAt} from '@renderer/features/slides/deckSelection';
import {
  LibraryPanel,
  type LibrarySelectionRequest,
} from '@renderer/features/songs/library/LibraryPanel';
import {useSongEditor} from '@renderer/features/songs/SongEditor';
import {
  openSongDraft,
  requestLeaveSong,
  useSongDraft,
} from '@renderer/features/songs/songDraft';
import {
  closePrepEditor,
  openInPrep,
  type PrepTarget,
} from '@renderer/session/prepTarget';
import {openItem, useShow} from '@renderer/session/show';
import {isLibrarySource, openLibrarySong} from '@renderer/session/showLibrary';
import {serviceItem} from '@renderer/session/openService';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';
import type {SizeClass} from '@renderer/ui/panels/sizeClass';
import {
  logPanelProblem,
  type PanelParts,
  type WorkspacePanels,
} from '../shell/WorkspacePanel';
import {SERVICE_ORDER, serviceOrderParts} from './serviceOrderPanel';

const COLUMNS = [['라이브러리'], [SERVICE_ORDER], ['세부정보']] as const;
const ITEM_COLUMNS = [[SERVICE_ORDER], ['편집'], ['슬라이드 속성']] as const;
const SONG_COLUMNS = [['라이브러리'], ['편집'], ['슬라이드 속성']] as const;

/** What 준비 works on. */
export interface PrepBinding {
  readonly api: LlpApi;
  readonly onNewSong: () => void;
  readonly openSong: (songId: SongId, position?: number) => void;
  readonly selectionRequest?: LibrarySelectionRequest | undefined;
  readonly onSelectionHandled?:
    ((request: LibrarySelectionRequest) => void) | undefined;
}

/** Opens an item in the editor of 준비, at a slide. */
export function editItemInPrep(itemId: string, position?: number): void {
  const item = serviceItem(itemId);
  if (item !== undefined && 'slides' in item && position !== undefined) {
    openDeckAt(item.id, item.slides[position]?.id);
  }
  openItem(itemId);
  requestLeaveSong(() => openInPrep({kind: 'item', itemId}));
}

function Library({
  prep,
  navigating,
  report,
}: {
  readonly prep: PrepBinding;
  readonly navigating: boolean;
  readonly report: (notice: Notice) => void;
}): ReactNode {
  const [tab, setTab] = useState<'elements' | 'songs'>('elements');
  const request = useRef(0);
  const selectSong = (songId: SongId): void => {
    const turn = ++request.current;
    const before = useShow.getState().openItemId;
    prep.api.library.showSong({songId}).then(
      song => {
        if (
          turn === request.current &&
          before === useShow.getState().openItemId &&
          song !== null
        ) {
          openLibrarySong(song);
        }
      },
      () => report(warningNotice('details:library', '곡 불러오기 실패')),
    );
  };
  return (
    <PrepPalette
      tab={tab}
      onTabChange={setTab}
      navigating={navigating}
      report={report}
      library={
        <LibraryPanel
          api={prep.api}
          navigating={navigating}
          selectionRequest={prep.selectionRequest}
          onSelectionHandled={prep.onSelectionHandled}
          onProblem={report}
          onNewSong={prep.onNewSong}
          onSelectSong={selectSong}
          beforeOpen={open => requestLeaveSong(open)}
          onOpenSong={({document, position, focusTitle}) => {
            openSongDraft(document, {focusTitle});
            openDeckAt(
              document.song.id,
              document.song.slides[position ?? 0]?.id,
            );
            openInPrep({kind: 'song'});
          }}
        />
      }
    />
  );
}

/** Moves the focus back to the row that the editor was opened from. */
function useReturnFocus(target: PrepTarget | null): void {
  const songId = useSongDraft(view => view.draft?.song.id ?? null);
  const origin = useRef<{
    readonly id: string;
    readonly library: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    if (target !== null) {
      const id = target.kind === 'item' ? target.itemId : songId;
      if (id !== null) origin.current = {id, library: target.kind === 'song'};
      return;
    }
    const before = origin.current;
    origin.current = null;
    if (before === null) return;
    const label = before.library ? '라이브러리 곡' : '예배 순서';
    // NOTE(0913vision): The kept 진행 list is inert and hidden; focus goes to
    // the one on screen.
    const list = [
      ...document.querySelectorAll<HTMLElement>(
        `[data-workspace-layout="prep"] [role="listbox"][aria-label="${label}"]`,
      ),
    ].find(element => element.closest('[inert]') === null);
    const row =
      list?.querySelector<HTMLElement>(`[data-value="${before.id}"]`) ??
      list?.querySelector<HTMLElement>('[aria-selected="true"]');
    row?.focus({preventScroll: true});
    row?.scrollIntoView({block: 'nearest'});
  }, [target, songId]);
}

/** The panels of 준비: 라이브러리, the 예배 순서 table, and an editor. */
export function usePrepPanels({
  prep,
  target,
  selectedItem: retainedItem,
  sizeClass,
  onProblem,
  onOpenPrep,
  onShowInLibrary,
}: {
  readonly prep: PrepBinding | undefined;
  /** What is edited; none shows the table. */
  readonly target: PrepTarget | null;
  readonly selectedItem?: string | null | undefined;
  readonly sizeClass: SizeClass;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep: ((itemId: string) => void) | undefined;
  readonly onShowInLibrary: ((songId: SongId) => void) | undefined;
}): WorkspacePanels {
  const report = onProblem ?? logPanelProblem;
  const requestedItem = useShow(view => view.openItemId);
  const selectedItem =
    retainedItem === undefined ? requestedItem : retainedItem;
  const back = (): void => requestLeaveSong(closePrepEditor);
  const ui = prep?.api.ui;
  const item = useItemEditor({
    itemId: target?.kind === 'item' ? target.itemId : null,
    report,
    onBack: back,
    ui,
  });
  const song = useSongEditor({report, onBack: back, ui});
  const editor = target === null ? null : target.kind === 'item' ? item : song;
  useReturnFocus(editor === null ? null : target);
  const selectedSong = useShow(view =>
    isLibrarySource(view, selectedItem) ? view.librarySong.songId : null,
  );
  const parsed = parseServiceItemId(selectedItem);
  const details: DetailsTarget | null =
    selectedSong !== null
      ? {kind: 'song', songId: selectedSong}
      : parsed.ok
        ? {kind: 'item', itemId: parsed.value}
        : null;
  const partsOf = (title: string): PanelParts => {
    if (prep === undefined) return {};
    switch (title) {
      case SERVICE_ORDER:
        return serviceOrderParts({
          workspace: 'prep',
          navigator: editor !== null,
          onProblem,
          onOpenPrep,
          onNavigate: id => editItemInPrep(id),
          onShowInLibrary,
          onOpenItem: () => undefined,
          actions: null,
          table: true,
        });
      case '라이브러리':
        return {
          embedded: (
            <Library prep={prep} navigating={editor !== null} report={report} />
          ),
        };
      case '편집':
        return {embedded: editor?.editor};
      case '슬라이드 속성':
        return {embedded: editor?.inspector};
      case '세부정보':
        return {
          embedded: (
            <DetailsPanel
              target={details}
              api={prep.api}
              sizeClass={sizeClass}
              onOpenItem={editItemInPrep}
              onOpenSong={prep.openSong}
              report={report}
            />
          ),
        };
      default:
        return {};
    }
  };
  const editing = editor !== null && target !== null;
  return {
    shownItem: editing && target.kind === 'item' ? target.itemId : selectedItem,
    editing,
    columns: !editing
      ? COLUMNS
      : target.kind === 'item'
        ? ITEM_COLUMNS
        : SONG_COLUMNS,
    partsOf,
  };
}
