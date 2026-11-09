import {useEffect, useState, type JSX} from 'react';
import type {LibrarySong} from '@core/schema/contentDocuments';
import type {SongId} from '@core/schema/ids';
import {LIBRARY_SEARCH_LIMITS} from '@core/schema/librarySearch';
import {Dialog} from '@renderer/ui/Dialog';
import {ListBox, ListRow} from '@renderer/ui/ListRow';
import {TextField} from '@renderer/ui/TextField';
import styles from './SongPicker.module.css';

/** Chooses an existing library song for a service order. */
export function SongPicker({
  onChoose,
  onClose,
}: {
  readonly onChoose: (song: SongId) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const [songs, setSongs] = useState<readonly LibrarySong[]>([]);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<{
    readonly query: string;
    readonly ids: readonly SongId[];
  } | null>(null);
  const [selected, setSelected] = useState<string>();
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let active = true;
    let pushed = false;
    const stop = api.songs.subscribeList(next => {
      pushed = true;
      if (active) setSongs(next);
    });
    api.songs.list().then(
      next => {
        if (active && !pushed) setSongs(next);
      },
      (error: unknown) => console.error('Could not read song list', error),
    );
    return () => {
      active = false;
      stop();
    };
  }, []);
  useEffect(() => {
    const api = window.llp;
    const term = query.trim();
    if (term === '' || api === undefined) return undefined;
    let active = true;
    const search = async (): Promise<void> => {
      const ids: SongId[] = [];
      for (
        let offset = 0;
        offset < songs.length;
        offset += LIBRARY_SEARCH_LIMITS.max
      ) {
        const result = await api.library.search({
          query: term,
          offset,
          limit: LIBRARY_SEARCH_LIMITS.max,
        });
        if (!active || result.query !== term) return;
        ids.push(...result.matches.map(match => match.songId));
        if (result.matches.length < LIBRARY_SEARCH_LIMITS.max) break;
      }
      if (active) setMatches({query: term, ids});
    };
    search().catch((error: unknown) => {
      if (active) setMatches({query: term, ids: []});
      console.error('Could not search songs', error);
    });
    return () => {
      active = false;
    };
  }, [query, songs]);
  const shown =
    query.trim() === ''
      ? songs
      : songs.filter(
          song =>
            matches?.query === query.trim() && matches.ids.includes(song.id),
        );
  const choice = shown.find(song => song.id === selected);
  return (
    <Dialog
      title="곡 추가"
      size="m"
      onCancel={onClose}
      primary={{
        label: '추가',
        disabled: choice === undefined,
        onSelect: () => {
          if (choice !== undefined) onChoose(choice.id);
        },
      }}
    >
      <div className={styles.content}>
        <TextField
          aria-label="곡 검색"
          placeholder="제목, 가사, 초성"
          icon="search"
          clearable
          block
          value={query}
          onChange={value => {
            setSelected(undefined);
            setQuery(value);
          }}
        />
        <div className={styles.list}>
          <ListBox
            label="라이브러리 곡 선택"
            selected={choice?.id}
            onSelect={setSelected}
          >
            {shown.map(song => (
              <ListRow
                key={song.id}
                value={song.id}
                title={song.title}
                icon="song"
              />
            ))}
          </ListBox>
        </div>
      </div>
    </Dialog>
  );
}
