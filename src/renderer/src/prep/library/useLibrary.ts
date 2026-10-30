import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {LibrarySong, SongDocument} from '@core/schema/contentDocuments';
import type {EditResult} from '@core/schema/contentEdit';
import {
  LIBRARY_SEARCH_LIMITS,
  type LibrarySearchResult,
} from '@core/schema/librarySearch';
import type {SongId} from '@core/schema/ids';
import {noticeTime, type Notice, type NoticeAction} from '@renderer/ui/notices';

export type LibraryApi = Pick<LlpApi, 'songs' | 'content' | 'services'> & {
  readonly library: Pick<LlpApi['library'], 'search'>;
};

export interface LibrarySelection {
  readonly document: SongDocument;
  readonly focusTitle: boolean;
  readonly position?: number | undefined;
}

export interface LibraryRow {
  readonly song: LibrarySong;
  readonly line?: string;
}

const titles = new Intl.Collator('ko', {numeric: true});
const problemTitles = {
  load: '라이브러리 불러오기 실패',
  search: '라이브러리 검색 실패',
  open: '곡 열기 실패',
  missing: '곡을 찾을 수 없음',
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
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<LibrarySearchResult | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);
  const [selected, setSelected] = useState<SongId | null>(null);
  const [loading, setLoading] = useState(true);
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
      if (isActive()) {
        problemHandler.current({
          key: `library:${cause}`,
          kind: 'warning',
          icon: 'warning',
          title: problemTitles[cause],
          time: noticeTime(),
          ...(action === undefined ? {} : {actions: [action]}),
        });
      }
    },
    [isActive],
  );

  const accept = useCallback((entries: readonly LibrarySong[]) => {
    requests.current.list++;
    const sorted = [...entries].sort(
      (a, b) => titles.compare(a.title, b.title) || a.id.localeCompare(b.id),
    );
    rows.current = sorted;
    setSongs(sorted);
    setSearch(null);
    setLoading(false);
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
  }, []);

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
    const stopSongs = api.songs.subscribe(() => {
      setSearch(null);
      setSearchVersion(value => value + 1);
    });
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
  }, [api, accept, report, isActive, reload]);

  useEffect(() => {
    if (query === '') return undefined;
    let current = true;
    const load = async (): Promise<void> => {
      const matches: Array<LibrarySearchResult['matches'][number]> = [];
      for (
        let offset = 0;
        offset < songs.length;
        offset += LIBRARY_SEARCH_LIMITS.max
      ) {
        const result = await api.library.search({
          query,
          limit: LIBRARY_SEARCH_LIMITS.max,
          ...(offset === 0 ? {} : {offset}),
        });
        if (!current || result.query !== query) return;
        matches.push(...result.matches);
        if (result.matches.length < LIBRARY_SEARCH_LIMITS.max) break;
      }
      if (current) setSearch({query, matches});
    };
    load().catch(() => {
      if (current) {
        setSearch(null);
        report('search', {
          icon: 'refresh',
          label: '다시 검색',
          onSelect: () => {
            if (isActive()) setSearchVersion(value => value + 1);
          },
        });
      }
    });
    return () => {
      current = false;
    };
  }, [api, query, songs, searchVersion, report, isActive]);

  const visible = useMemo<readonly LibraryRow[]>(() => {
    if (query === '') return songs.map(song => ({song}));
    if (search?.query !== query) return [];
    const byId = new Map(songs.map(song => [song.id, song]));
    return search.matches.flatMap(match => {
      const song = byId.get(match.songId);
      if (song === undefined) return [];
      return [
        {
          song,
          ...(match.match.kind === 'lyrics' ? {line: match.match.line} : {}),
        },
      ];
    });
  }, [songs, query, search]);

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

  const create = async (): Promise<void> => {
    if (editing.current) return;
    editing.current = true;
    setBusy(true);
    setQuery('');
    const version = ++requests.current.open;
    opening.current = null;
    try {
      const result = await api.content.edit({type: 'song.create'});
      if (!isActive()) return;
      const id = appliedId(result);
      if (id === null) return;
      if (!(await readList())) report('load', loadAction(reload));
      const document = await api.songs.get(id);
      if (!isActive() || version !== requests.current.open) return;
      if (document === null) {
        report('missing');
        return;
      }
      setSelected(document.song.id);
      onOpenSong({document, focusTitle: true});
    } catch {
      report('create');
    } finally {
      editing.current = false;
      if (isActive()) setBusy(false);
    }
  };

  const remove = async (id: SongId): Promise<boolean> => {
    if (
      editing.current ||
      rows.current.find(song => song.id === id)?.access !== 'editable'
    ) {
      return false;
    }
    editing.current = true;
    setBusy(true);
    try {
      const result = await api.content.edit({type: 'song.delete', songId: id});
      if (!isActive() || appliedId(result) === null) return false;
      if (!(await readList())) report('load', loadAction(reload));
      return isActive();
    } catch {
      report('delete');
      return false;
    } finally {
      editing.current = false;
      if (isActive()) setBusy(false);
    }
  };

  return {
    songs,
    visible,
    query,
    setQuery: (value: string): void => {
      if (value === query) return;
      setSearch(null);
      setQuery(value);
    },
    selected,
    clearSelection: (): void => {
      requests.current.open++;
      opening.current = null;
      setSelected(null);
    },
    loading,
    busy,
    report,
    open,
    create,
    remove,
  };
}
