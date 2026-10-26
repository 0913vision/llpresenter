import {useEffect, useEffectEvent, useRef, useState} from 'react';
import type {LibrarySearchMatch} from '@shared/schema/librarySearch';
import {useShow} from '@renderer/state/show';
import {openLibrarySong} from '@renderer/state/showLibrary';
import {withinLookupTimeout} from '@renderer/state/showOutput';
import {noticeTime, type Notice} from '@renderer/ui/notices';

export const TOOLBAR_SEARCH_LIMIT = 20;

interface SearchReply {
  readonly query: string;
  readonly matches: readonly LibrarySearchMatch[];
  readonly failed: boolean;
}

const noMatches: readonly LibrarySearchMatch[] = [];
const noReply: SearchReply = {query: '', matches: noMatches, failed: false};

function problem(title: string, name?: string): Notice {
  return {
    key: 'toolbar-search',
    kind: 'warning',
    icon: 'warning',
    title,
    meta: name ? [name] : undefined,
    time: noticeTime(),
  };
}

function logFailure(message: string, cause: unknown): void {
  window.llp?.log.write({
    level: 'error',
    message,
    detail: cause instanceof Error ? cause.message : String(cause),
  });
}

// NOTE(0913vision): The query includes text that is still composing. The
// Windows Korean IME keeps each syllable in a composition, and the last one
// stays open while the operator pauses, so waiting for confirmation would show
// no list for a Korean query.
/** Searches for the field's query, again whenever a song changes. */
function useSearchReply({
  enabled,
  query,
  onProblem,
}: {
  readonly enabled: boolean;
  readonly query: string;
  readonly onProblem: (notice: Notice) => void;
}): SearchReply {
  const [reply, setReply] = useState(noReply);
  const report = useEffectEvent(onProblem);

  useEffect(() => {
    const api = window.llp;
    const term = query.trim();
    if (!enabled || !term || !api) return undefined;
    let active = true;
    let version = 0;
    const search = async (): Promise<void> => {
      const request = ++version;
      const isCurrent = (): boolean => active && request === version;
      try {
        const found = await api.library.search({
          query: term,
          limit: TOOLBAR_SEARCH_LIMIT,
        });
        if (!isCurrent() || found.query !== term) return;
        setReply({
          query,
          matches: found.matches.slice(0, TOOLBAR_SEARCH_LIMIT),
          failed: false,
        });
      } catch (cause) {
        logFailure('Could not search the toolbar library', cause);
        if (!isCurrent()) return;
        setReply({query, matches: noMatches, failed: true});
        report(problem('검색 실패'));
      }
    };
    const refresh = (): void => {
      if (!active) return;
      search().catch((cause: unknown) =>
        console.error('Toolbar search callback failed:', cause),
      );
    };
    const stop = api.songs.subscribe(refresh);
    refresh();
    return () => {
      active = false;
      version++;
      stop();
    };
  }, [enabled, query]);
  return reply;
}

/**
 * Opens a chosen result as the library source. A later choice, a new query,
 * a change of the open item or slide, or unmounting drops a pending read, and
 * a read that takes longer than the lookup timeout fails.
 */
function useResultChooser(
  enabled: boolean,
  onProblem: (notice: Notice) => void,
): {
  readonly choose: (match: LibrarySearchMatch) => Promise<void>;
  readonly supersede: () => void;
} {
  const alive = useRef(false);
  const selection = useRef({version: 0});

  useEffect(() => {
    alive.current = enabled;
    const pending = selection.current;
    const stop = useShow.subscribe((next, previous) => {
      if (
        next.openItemId !== previous.openItemId ||
        next.selectedTile !== previous.selectedTile
      ) {
        pending.version++;
      }
    });
    return () => {
      alive.current = false;
      pending.version++;
      stop();
    };
  }, [enabled]);

  const choose = async (match: LibrarySearchMatch): Promise<void> => {
    const api = window.llp;
    if (!enabled || !api) return;
    const request = ++selection.current.version;
    const isCurrent = (): boolean =>
      alive.current && request === selection.current.version;
    try {
      const song = await withinLookupTimeout(() =>
        api.library.showSong({songId: match.songId}),
      );
      if (!isCurrent()) return;
      if (song === null) {
        onProblem(problem('곡을 찾을 수 없음', match.title));
      } else {
        openLibrarySong(song);
      }
    } catch (cause) {
      logFailure('Could not open the toolbar library result', cause);
      if (isCurrent()) onProblem(problem('곡 불러오기 실패', match.title));
    }
  };
  const supersede = (): void => {
    selection.current.version++;
  };
  return {choose, supersede};
}

/** Bounded search and source reads; late replies cannot replace a later choice. */
export function useToolbarSearch(
  enabled: boolean,
  onProblem: (notice: Notice) => void,
) {
  const [query, setQuery] = useState('');
  const reply = useSearchReply({enabled, query, onProblem});
  const {choose, supersede} = useResultChooser(enabled, onProblem);
  const answered = reply.query === query;
  return {
    query,
    setQuery: (value: string): void => {
      supersede();
      setQuery(value);
    },
    matches: answered ? reply.matches : noMatches,
    loading: query.trim() !== '' && !answered,
    failed: answered && reply.failed,
    choose,
  };
}
