import {songSlidesOf} from '@core/schema/songs/song';
import {useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {parseServiceItemId, type SongId} from '@core/schema/common/ids';
import {
  DetailsPanel,
  type DetailsTarget,
} from '@renderer/features/service/details/DetailsPanel';
import {useItemEditor} from '@renderer/features/service/editor/useItemEditor';
import {PrepPalette} from '@renderer/features/service/items/PrepPalette';
import {openDeckAt} from '@renderer/features/slides/deckSelection';
import {LibraryPanel} from '@renderer/features/songs/library/LibraryPanel';
import {useSongEditor} from '@renderer/features/songs/SongEditor';
import {
  closeSongDraft,
  openSongDraft,
  requestLeaveSong,
  useSongDraft,
} from '@renderer/features/songs/draft';
import {
  closePrepEditor,
  openInLibrary,
  openInPrep,
  type PrepTarget,
} from '@renderer/session/prepTarget';
import {openItem} from '@renderer/session/show/show';
import {
  isLibrarySource,
  openLibrarySong,
} from '@renderer/session/show/showLibrary';
import {serviceItem} from '@renderer/session/service/openService';
import {SearchResultsPanel} from '@renderer/app/shell/toolbar/SearchResultsPanel';
import {useShownSearch} from '@renderer/app/shell/toolbar/searchResults';
import type {Notice} from '@renderer/ui/popups/notices';
import {
  logPanelProblem,
  type PanelParts,
  type WorkspacePanels,
} from '../shell/workspace/WorkspacePanel';
import {SERVICE_ORDER, serviceOrderParts} from './serviceOrderPanel';
import {useShow} from '@renderer/session/show/showStore';
import type {SizeClass} from '@core/schema/app/appConfig';
import {readLibrarySong} from '@renderer/features/songs/library/readLibrarySong';
import {editorTask} from '@renderer/platform/editorTask';

const COLUMNS = [['라이브러리'], [SERVICE_ORDER], ['세부정보']] as const;
const ITEM_COLUMNS = [[SERVICE_ORDER], ['편집'], ['슬라이드 속성']] as const;
const SONG_COLUMNS = [['라이브러리'], ['편집'], ['슬라이드 속성']] as const;

/** What 준비 works on. */
export interface PrepBinding {
  readonly api: LlpApi;
  readonly onNewSong: () => void;
  readonly openSong: (songId: SongId, position?: number) => void;
}

/** Opens an item in the editor of 준비, at a slide. */
export function editItemInPrep(itemId: string, position?: number): void {
  const item = serviceItem(itemId);
  if (item !== undefined && 'slides' in item && position !== undefined) {
    openDeckAt(item.id, item.slides[position]?.id);
  }
  openItem(itemId);
  openInPrep({kind: 'item', itemId});
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
    editorTask(
      readLibrarySong(prep.api, songId, {key: 'details:library', report}).then(
        song => {
          if (
            song &&
            turn === request.current &&
            before === useShow.getState().openItemId
          ) {
            openLibrarySong(song);
          }
        },
      ),
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
          embedded={!navigating}
          onProblem={report}
          onNewSong={prep.onNewSong}
          onSelectSong={selectSong}
          beforeOpen={open => requestLeaveSong(open)}
          onOpenSong={({document, position, focusTitle}) => {
            openSongDraft(document, {focusTitle});
            openDeckAt(
              document.song.id,
              songSlidesOf(document.song)[position ?? 0]?.id,
            );
            openInLibrary();
          }}
        />
      }
    />
  );
}

/**
 * Moves the focus back to the row an editor was opened from once it closes,
 * when the closing took the focus away with it: `openId` is what the editor
 * has open, none once it closes. A focus that is still somewhere, such as the
 * row just clicked to open another song (the one before closes first), stays.
 */
function useReturnFocus(
  workspace: 'prep' | 'library',
  openId: string | null,
): void {
  const origin = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (openId !== null) {
      origin.current = openId;
      return;
    }
    const before = origin.current;
    origin.current = null;
    const active = document.activeElement;
    if (before === null || (active !== null && active !== document.body)) {
      return;
    }
    const label = workspace === 'library' ? '라이브러리 곡' : '예배 순서';
    const list = document.querySelector<HTMLElement>(
      `[data-workspace-frame="${workspace}"] [role="listbox"][aria-label="${label}"]`,
    );
    const row =
      list?.querySelector<HTMLElement>(`[data-value="${before}"]`) ??
      list?.querySelector<HTMLElement>('[aria-selected="true"]');
    row?.focus({preventScroll: true});
    row?.scrollIntoView({block: 'nearest'});
  }, [workspace, openId]);
}

/** What the panels of 준비 and 라이브러리 work with. */
interface PanelsInput {
  readonly prep: PrepBinding | undefined;
  readonly sizeClass: SizeClass;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep: ((itemId: string) => void) | undefined;
  readonly onShowInLibrary: ((songId: SongId) => void) | undefined;
}

/** The library songs at the left of 준비 and of 라이브러리. */
function libraryParts(
  prep: PrepBinding,
  navigating: boolean,
  report: (notice: Notice) => void,
): PanelParts {
  return {
    embedded: <Library prep={prep} navigating={navigating} report={report} />,
  };
}

/**
 * The panels of 준비: 예배 요소 and the library songs, the 예배 순서 table, and
 * an item's editor once one is open.
 */
export function usePrepPanels({
  prep,
  target,
  selectedItem: retainedItem,
  sizeClass,
  onProblem,
  onOpenPrep,
  onShowInLibrary,
}: PanelsInput & {
  /** The item being edited; none shows the table. */
  readonly target: PrepTarget | null;
  readonly selectedItem?: string | null | undefined;
}): WorkspacePanels {
  const report = onProblem ?? logPanelProblem;
  const requestedItem = useShow(view => view.openItemId);
  const selectedItem =
    retainedItem === undefined ? requestedItem : retainedItem;
  const item = useItemEditor({
    itemId: target?.itemId ?? null,
    report,
    onBack: closePrepEditor,
    onShowInLibrary,
    ui: prep?.api.ui,
  });
  const shownSearch = useShownSearch('prep');
  const editing = item !== null && target !== null;
  useReturnFocus('prep', editing ? target.itemId : null);
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
  const columns = editing ? ITEM_COLUMNS : COLUMNS;
  const partsOf = (title: string): PanelParts => {
    if (prep === undefined) return {};
    // NOTE(0913vision): A toolbar search's results take the center column
    // until closed, as the 성경 panel does in 진행.
    if (shownSearch !== null && title === columns[1][0]) {
      return {
        embedded: <SearchResultsPanel shown={shownSearch} onProblem={report} />,
      };
    }
    switch (title) {
      case SERVICE_ORDER:
        return serviceOrderParts({
          workspace: 'prep',
          navigator: editing,
          onProblem,
          onOpenPrep,
          onNavigate: id => editItemInPrep(id),
          onShowInLibrary,
          onOpenItem: () => undefined,
          actions: null,
          table: true,
        });
      case '라이브러리':
        return libraryParts(prep, false, report);
      case '편집':
        return {embedded: item?.editor};
      case '슬라이드 속성':
        return {embedded: item?.inspector};
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
  return {
    shownItem: editing ? target.itemId : selectedItem,
    columns,
    partsOf,
  };
}

/**
 * The panels of 라이브러리: the library songs, the open song's editor and its
 * slide properties. The columns stay while no song is open, as after the open
 * song is deleted, so its 실행 취소 brings it back open.
 */
export function useLibraryPanels({
  prep,
  onProblem,
}: Pick<PanelsInput, 'prep' | 'onProblem'>): WorkspacePanels {
  const report = onProblem ?? logPanelProblem;
  const song = useSongEditor({
    report,
    onBack: () => requestLeaveSong(closeSongDraft),
    ui: prep?.api.ui,
  });
  const songId = useSongDraft(view => view.draft?.song.id ?? null);
  useReturnFocus('library', songId);
  const shownSearch = useShownSearch('library');
  const partsOf = (title: string): PanelParts => {
    if (prep === undefined) return {};
    if (shownSearch !== null && title === SONG_COLUMNS[1][0]) {
      return {
        embedded: <SearchResultsPanel shown={shownSearch} onProblem={report} />,
      };
    }
    switch (title) {
      case '라이브러리':
        return libraryParts(prep, true, report);
      case '편집':
        return {embedded: song?.editor};
      case '슬라이드 속성':
        return {embedded: song?.inspector};
      default:
        return {};
    }
  };
  return {columns: SONG_COLUMNS, partsOf};
}
