import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {LibrarySong, SongDocument} from '@shared/schema/contentDocuments';
import type {EditResult} from '@shared/schema/contentEdit';
import {
  LIBRARY_SEARCH_LIMITS,
  type LibrarySearchResult,
} from '@shared/schema/librarySearch';
import type {SongId} from '@shared/schema/ids';
import type {Notice} from '@renderer/ui/notices';

export type LibraryApi = Pick<LlpApi, 'songs' | 'library' | 'content'>;

export interface LibrarySelection {
  readonly document: SongDocument;
  readonly focusTitle: boolean;
}

export interface LibraryRow {
  readonly song: LibrarySong;
  readonly line?: string;
}

const titles = new Intl.Collator('ko', {numeric: true});

/** Owns this panel's reads and edits; main remains the source of song data. */
export function useLibrary(
  api: LibraryApi,
  onOpenSong: (selection: LibrarySelection) => void,
) {
  const [songs, setSongs] = useState<readonly LibrarySong[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<LibrarySearchResult | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);
  const [selected, setSelected] = useState<SongId | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Notice | null>(null);
  const alive = useRef(false);
  const rows = useRef<readonly LibrarySong[]>([]);
  const requests = useRef({list: 0, open: 0});
  const opening = useRef<string | null>(null);
  const editing = useRef(false);
  const isActive = useCallback(() => alive.current, []);

  const report = useCallback(
    (title: string) => {
      if (isActive()) {
        setProblem({
          key: 'library',
          kind: 'warning',
          icon: 'warning',
          title,
          time: new Date().toTimeString().slice(0, 5),
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
        report('라이브러리 불러오기 실패');
      }
    }
  }, [api, accept, report, isActive]);

  useEffect(() => {
    alive.current = true;
    const pending = requests.current;
    const stopList = api.songs.subscribeList(entries => {
      if (isActive()) accept(entries);
    });
    const stopSongs = api.songs.subscribe(() =>
      setSearchVersion(value => value + 1),
    );
    const version = ++pending.list;
    api.songs.list().then(
      entries => {
        if (isActive() && version === pending.list) accept(entries);
      },
      () => {
        if (isActive() && version === pending.list) {
          setLoading(false);
          report('라이브러리 불러오기 실패');
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
  }, [api, accept, report, isActive]);

  useEffect(() => {
    if (query === '') return undefined;
    let current = true;
    api.library.search({query, limit: LIBRARY_SEARCH_LIMITS.max}).then(
      result => {
        if (current && result.query === query) setSearch(result);
      },
      () => {
        if (current) report('라이브러리 검색 실패');
      },
    );
    return () => {
      current = false;
    };
  }, [api, query, songs, searchVersion, report]);

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

  const open = async (songId: SongId): Promise<void> => {
    const version = ++requests.current.open;
    opening.current = songId;
    setSelected(songId);
    try {
      const document = await api.songs.get(songId);
      if (!isActive() || version !== requests.current.open) return;
      if (document === null) {
        report('곡을 찾을 수 없습니다');
        return;
      }
      onOpenSong({document, focusTitle: false});
    } catch {
      if (version === requests.current.open) report('곡 열기 실패');
    }
  };

  const appliedId = (result: EditResult): string | null => {
    if (result.ok) return result.value.id;
    if (result.error.reason === 'write-failed') {
      report('곡 파일 저장 실패');
      return result.error.applied.id;
    }
    report('곡 변경 실패');
    return null;
  };

  const create = async (): Promise<void> => {
    if (editing.current) return;
    editing.current = true;
    setBusy(true);
    setProblem(null);
    setQuery('');
    const version = ++requests.current.open;
    opening.current = null;
    try {
      const result = await api.content.edit({type: 'song.create'});
      if (!isActive()) return;
      const id = appliedId(result);
      if (id === null) return;
      await readList();
      const document = await api.songs.get(id);
      if (!isActive() || version !== requests.current.open) return;
      if (document === null) {
        report('곡을 찾을 수 없습니다');
        return;
      }
      setSelected(document.song.id);
      onOpenSong({document, focusTitle: true});
    } catch {
      report('새 곡 만들기 실패');
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
    setProblem(null);
    try {
      const result = await api.content.edit({type: 'song.delete', songId: id});
      if (!isActive() || appliedId(result) === null) return false;
      await readList();
      return isActive();
    } catch {
      report('곡 삭제 실패');
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
    setQuery,
    selected,
    loading,
    busy,
    problem,
    dismissProblem: () => setProblem(null),
    report,
    open,
    create,
    remove,
    reload: () => {
      if (editing.current) return;
      setLoading(true);
      setProblem(null);
      readList().catch(() => report('라이브러리 불러오기 실패'));
    },
  };
}
