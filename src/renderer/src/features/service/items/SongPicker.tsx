import {useEffect, useId, useState, type JSX, type KeyboardEvent} from 'react';
import type {LibrarySong} from '@core/schema/contentDocuments';
import type {SongId} from '@core/schema/ids';
import {LIBRARY_SEARCH_LIMITS} from '@core/schema/librarySearch';
import {Dialog} from '@renderer/ui/Dialog';
import {ListBox, ListRow} from '@renderer/ui/ListRow';
import {TextField} from '@renderer/ui/TextField';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
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
  const listId = useId();
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
  const matchingIds = new Set(
    matches?.query === query.trim() ? matches.ids : [],
  );
  const shown =
    query.trim() === ''
      ? songs
      : songs.filter(song => matchingIds.has(song.id));
  const choice =
    shown.find(song => song.id === selected) ??
    (query.trim() === '' ? undefined : shown.at(0));
  const choiceId = choice?.id;
  const optionId = (id: SongId): string => `${listId}-${id}`;
  useEffect(() => {
    if (choiceId !== undefined) {
      document
        .getElementById(`${listId}-${choiceId}`)
        ?.scrollIntoView({block: 'nearest'});
    }
  }, [choiceId, listId]);
  const fieldKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (isComposing(event) || hasModifier(event)) return;
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const current = shown.findIndex(song => song.id === choice?.id);
    const index =
      event.key === 'ArrowDown'
        ? Math.min(shown.length - 1, current + 1)
        : Math.max(0, current - 1);
    setSelected(shown[index]?.id);
  };
  const optionSong = (target: EventTarget | null): SongId | undefined => {
    const option =
      target instanceof Element
        ? target.closest<HTMLElement>('[role="option"]')
        : null;
    return shown.find(song => song.id === option?.dataset['value'])?.id;
  };
  return (
    <Dialog
      title="곡 추가"
      size="m"
      onCancel={onClose}
      primary={{
        label: '추가',
        disabled: choice === undefined,
        title: choice === undefined ? '선택할 곡이 없습니다' : undefined,
        onSelect: () => {
          if (choice !== undefined) onChoose(choice.id);
        },
      }}
    >
      <div className={styles.content}>
        <TextField
          aria-label="곡 검색"
          role="combobox"
          aria-expanded={choice !== undefined}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            choice === undefined ? undefined : optionId(choice.id)
          }
          placeholder="제목, 가사, 초성"
          icon="search"
          clearable
          escapeClears={false}
          block
          value={query}
          onChange={value => {
            setSelected(undefined);
            setQuery(value);
          }}
          onKeyDown={fieldKeyDown}
        />
        <div
          className={styles.list}
          onDoubleClick={event => {
            const song = optionSong(event.target);
            if (song !== undefined) onChoose(song);
          }}
          onKeyDownCapture={event => {
            if (
              event.key !== 'Enter' ||
              isComposing(event) ||
              hasModifier(event)
            ) {
              return;
            }
            const song = optionSong(event.target);
            if (song !== undefined) {
              event.preventDefault();
              event.stopPropagation();
              onChoose(song);
            }
          }}
        >
          <ListBox
            id={listId}
            label="라이브러리 곡 선택"
            selected={choice?.id}
            onSelect={setSelected}
          >
            {shown.map(song => (
              <ListRow
                key={song.id}
                optionId={optionId(song.id)}
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
