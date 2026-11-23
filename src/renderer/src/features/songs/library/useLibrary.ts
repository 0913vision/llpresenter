import {useCallback, useEffect, useRef, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {LibrarySong, SongDocument} from '@core/schema/contentDocuments';
import type {EditResult} from '@core/schema/contentEdit';
import type {SongId} from '@core/schema/ids';
import {noticeTime, type Notice, type NoticeAction} from '@renderer/ui/notices';
import {useLibrarySearch} from './useLibrarySearch';
import {
  createSong,
  deleteSong,
  duplicateSong,
  renameSong,
  type SongCommandContext,
} from './songCommands';

export type LibraryApi = Pick<LlpApi, 'songs' | 'content' | 'services'> & {
  readonly library: Pick<LlpApi['library'], 'search' | 'revealSong'>;
};

export interface LibrarySelection {
  readonly document: SongDocument;
  readonly focusTitle: boolean;
  readonly position?: number | undefined;
}

export type {LibraryRow} from './librarySearch';

const titles = new Intl.Collator('ko', {numeric: true});
const problemTitles = {
  load: '라이브러리 불러오기 실패',
  search: '라이브러리 검색 실패',
  open: '곡 열기 실패',
  missing: '곡을 찾을 수 없습니다.',
  create: '새 곡 만들기 실패',
  delete: '곡 삭제 실패',
  save: '곡 파일 저장 실패',
  change: '곡 변경 실패',
} as const;

function loadAction(onSelect: () => void): NoticeAction {
  return {icon: 'refresh', label: '다시 불러오기', onSelect};
}

/** Owns this panel's reads and edits; main remains the source of song data. */
export function useLibrary(
  api: LibraryApi,
  onOpenSong: (selection: LibrarySelection) => void,
  onProblem: (notice: Notice) => void,
) {
  const [songs, setSongs] = useState<readonly LibrarySong[]>([]);
  const [selected, setSelected] = useState<SongId | null>(null);
  const [loading, setLoading] = useState(true);
  const [listed, setListed] = useState(false);
  const [busy, setBusy] = useState(false);
  const problemHandler = useRef(onProblem);
  useEffect(() => {
    problemHandler.current = onProblem;
  }, [onProblem]);
  const alive = useRef(false);
  const rows = useRef<readonly LibrarySong[]>([]);
  const requests = useRef({list: 0, open: 0});
  const opening = useRef<string | null>(null);
  const editing = useRef(false);
  const isActive = useCallback(() => alive.current, []);

  const report = useCallback(
    (cause: keyof typeof problemTitles, action?: NoticeAction) => {
      // NOTE(0913vision): The handler belongs to the app, not to this panel, so
      // a failure that ends after the panel is gone still gets its card.
      problemHandler.current({
        key: `library:${cause}`,
        kind: 'warning',
        icon: 'warning',
        title: problemTitles[cause],
        time: noticeTime(),
        ...(action === undefined ? {} : {actions: [action]}),
      });
    },
    [],
  );

  const {
    clear: clearSearch,
    again: searchAgain,
    ...search
  } = useLibrarySearch({
    api,
    songs,
    report,
    isActive,
  });

  const accept = useCallback(
    (entries: readonly LibrarySong[]) => {
      requests.current.list++;
      const sorted = [...entries].sort(
        (a, b) => titles.compare(a.title, b.title) || a.id.localeCompare(b.id),
      );
      rows.current = sorted;
      setSongs(sorted);
      clearSearch();
      setLoading(false);
      setListed(true);
      setSelected(current =>
        sorted.some(song => song.id === current) ? current : null,
      );
      if (
        opening.current !== null &&
        !sorted.some(song => song.id === opening.current)
      ) {
        requests.current.open++;
        opening.current = null;
      }
    },
    [clearSearch],
  );

  const readList = useCallback(async () => {
    const version = ++requests.current.list;
    try {
      const entries = await api.songs.list();
      if (isActive() && version === requests.current.list) accept(entries);
    } catch {
      if (isActive() && version === requests.current.list) {
        setLoading(false);
        return false;
      }
    }
    return true;
  }, [api, accept, isActive]);

  const reload = useCallback(
    function retryLoad(): void {
      if (!isActive() || editing.current) return;
      setLoading(true);
      readList().then(
        loaded => {
          if (!loaded) report('load', loadAction(retryLoad));
        },
        () => report('load', loadAction(retryLoad)),
      );
    },
    [isActive, readList, report],
  );

  useEffect(() => {
    alive.current = true;
    const pending = requests.current;
    const stopList = api.songs.subscribeList(entries => {
      if (isActive()) accept(entries);
    });
    const stopSongs = api.songs.subscribe(searchAgain);
    const version = ++pending.list;
    api.songs.list().then(
      entries => {
        if (isActive() && version === pending.list) accept(entries);
      },
      () => {
        if (isActive() && version === pending.list) {
          setLoading(false);
          report('load', loadAction(reload));
        }
      },
    );
    return () => {
      alive.current = false;
      pending.list++;
      pending.open++;
      stopList();
      stopSongs();
    };
  }, [api, accept, report, isActive, reload, searchAgain]);

  const open = async (songId: SongId, position?: number): Promise<void> => {
    const version = ++requests.current.open;
    opening.current = songId;
    setSelected(songId);
    try {
      const document = await api.songs.get(songId);
      if (!isActive() || version !== requests.current.open) return;
      if (document === null) {
        report('missing');
        return;
      }
      onOpenSong({
        document,
        focusTitle: false,
        ...(position === undefined ? {} : {position}),
      });
    } catch {
      if (version === requests.current.open) report('open');
    }
  };

  const appliedId = (result: EditResult): string | null => {
    if (result.ok) return result.value.id;
    if (result.error.reason === 'write-failed') {
      report('save');
      return result.error.applied.id;
    }
    report('change');
    return null;
  };

  /**
   * Runs one song edit at a time with the panel busy. When it throws,
   * `failure` is reported and `fallback` answered.
   */
  const runEdit = async <T>(
    failure: keyof typeof problemTitles,
    fallback: T,
    run: () => Promise<T>,
  ): Promise<T> => {
    if (editing.current) return fallback;
    editing.current = true;
    setBusy(true);
    try {
      return await run();
    } catch {
      report(failure);
      return fallback;
    } finally {
      editing.current = false;
      if (isActive()) setBusy(false);
    }
  };
  /** Reads the list again after an edit, so the change shows at once. */
  const relist = async (): Promise<void> => {
    if (!(await readList())) report('load', loadAction(reload));
  };
  const editable = (id: SongId): boolean =>
    rows.current.find(song => song.id === id)?.access === 'editable';

  const commands: SongCommandContext = {
    api,
    applied: appliedId,
    relist,
    isActive,
    missing: () => report('missing'),
  };

  const create = (): Promise<void> =>
    runEdit('create', undefined, async () => {
      search.change('');
      const version = ++requests.current.open;
      opening.current = null;
      const id = await createSong(commands);
      if (id === null) return;
      const document = await api.songs.get(id);
      if (!isActive() || version !== requests.current.open) return;
      if (document === null) {
        report('missing');
        return;
      }
      setSelected(document.song.id);
      onOpenSong({document, focusTitle: true});
    });

  const duplicate = async (id: SongId): Promise<void> => {
    if (!editable(id)) return;
    await runEdit('create', undefined, async () => {
      const copyId = await duplicateSong(
        commands,
        id,
        rows.current.map(song => song.title),
      );
      if (copyId === null) return;
      const created = await api.songs.get(copyId);
      if (created !== null && isActive()) setSelected(created.song.id);
    });
  };

  const remove = async (id: SongId): Promise<boolean> =>
    editable(id) && runEdit('delete', false, () => deleteSong(commands, id));

  const rename = async (id: SongId, title: string): Promise<boolean> =>
    editable(id) &&
    runEdit('change', false, () => renameSong(commands, id, title));

  return {
    songs,
    visible: search.visible,
    query: search.query,
    setQuery: search.change,
    selected,
    select: setSelected,
    clearSelection: (): void => {
      requests.current.open++;
      opening.current = null;
      setSelected(null);
    },
    loading,
    /** The song list has been read at least once, so an empty list is real. */
    listed,
    /** The search for the current query has answered. */
    searched: search.searched,
    busy,
    report,
    open,
    create,
    duplicate,
    remove,
    rename,
  };
}
