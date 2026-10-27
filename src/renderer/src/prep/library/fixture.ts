import type {
  LibrarySong,
  SongChange,
  SongDocument,
} from '@shared/schema/contentDocuments';
import {parseSongDocument} from '@shared/schema/contentDocuments';
import {
  createServiceId,
  createSongId,
  createSongGroupId,
} from '@shared/schema/ids';
import {sourceSlideCount} from '@shared/schema/groupedSong';
import {LIBRARY_SEARCH_LIMITS} from '@shared/schema/librarySearch';
import type {EditResult} from '@shared/schema/contentEdit';
import type {LibraryApi} from './useLibrary';

export function fixtureSong(number: number, title: string): SongDocument {
  const parsed = parseSongDocument({
    song: {
      format: 'llsong',
      schemaVersion: 2,
      id: createSongId(
        `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
      ),
      title,
      groups: [
        {
          id: createSongGroupId(
            `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
          ),
          name: '',
          slides: [{lines: [`Invented words ${number}`]}],
        },
      ],
    },
    revision: 1,
    access: 'editable',
  });
  if (!parsed.ok || parsed.value === null) {
    throw new Error('Invalid library fixture');
  }
  return parsed.value;
}

/** An in-memory gallery fixture with the same reads, edits, and pushes as main. */
export function libraryFixture(
  initial = [
    fixtureSong(1, '찬송 10'),
    fixtureSong(2, '만복의 근원 하나님'),
    fixtureSong(3, '찬송 2'),
  ],
) {
  const documents = new Map(
    initial.map(document => [document.song.id, document]),
  );
  const listListeners = new Set<(songs: readonly LibrarySong[]) => void>();
  const songListeners = new Set<(change: SongChange) => void>();
  let sequence = initial.length + 1;
  const list = (): readonly LibrarySong[] =>
    [...documents.values()].map(document => ({
      id: document.song.id,
      title: document.song.title,
      slideCount: sourceSlideCount(document.song),
      access: document.access,
      usedBy:
        document.song.id === initial[0]?.song.id
          ? [1, 2].map(number => ({
              id: createServiceId(
                `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
              ),
              name: `Invented service ${number}`,
            }))
          : [],
    }));
  const pushList = (entries = list()): void => {
    for (const listener of listListeners) listener(entries);
  };
  const pushSong = (change: SongChange): void => {
    for (const listener of songListeners) listener(change);
  };
  const api: LibraryApi = {
    songs: {
      list: () => Promise.resolve(list()),
      get: id =>
        Promise.resolve(
          [...documents.values()].find(document => document.song.id === id) ??
            null,
        ),
      subscribeList: listener => {
        listListeners.add(listener);
        return () => {
          listListeners.delete(listener);
        };
      },
      subscribe: listener => {
        songListeners.add(listener);
        return () => {
          songListeners.delete(listener);
        };
      },
    },
    library: {
      search: ({query, limit = LIBRARY_SEARCH_LIMITS.default}) =>
        Promise.resolve({
          query,
          matches: list()
            .filter(song =>
              query === 'ㅁㅂㅇ'
                ? song.title === '만복의 근원 하나님'
                : song.title.toLowerCase().includes(query.toLowerCase()),
            )
            .slice(0, limit)
            .map(song => ({
              songId: song.id,
              title: song.title,
              slideCount: song.slideCount,
              match: {kind: 'title'},
            })),
        }),
    },
    content: {
      edit: (edit): Promise<EditResult> => {
        if (edit.type === 'song.create') {
          let title = '새 곡';
          let suffix = 2;
          while (list().some(song => song.title === title)) {
            title = `새 곡 ${suffix++}`;
          }
          const document = fixtureSong(sequence++, title);
          documents.set(document.song.id, {
            ...document,
            song: {
              ...document.song,
              groups: document.song.groups.map(group => ({
                ...group,
                slides: [{lines: []}],
              })),
            },
          });
          pushList();
          return Promise.resolve({
            ok: true,
            value: {id: document.song.id, revision: document.revision},
          });
        }
        if (edit.type === 'song.delete') {
          documents.delete(edit.songId);
          pushSong({songId: edit.songId, document: null});
          pushList();
          return Promise.resolve({
            ok: true,
            value: {id: edit.songId, revision: null},
          });
        }
        return Promise.resolve({
          ok: false,
          error: {reason: 'invalid', message: 'Unsupported gallery edit'},
        });
      },
    },
  };
  return {
    api,
    documents,
    list,
    pushList,
    pushSong,
    listListeners,
    songListeners,
  };
}
