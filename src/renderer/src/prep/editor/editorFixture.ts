import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {createSongGroupId, createSongId} from '@core/schema/ids';
import {sourceSlideCount} from '@core/schema/groupedSong';
import type {EditorSongDocument} from './songSession';
import {
  parseSongDocument,
  type SongChange,
  type LibrarySong,
  type SongDocument,
} from '@core/schema/contentDocuments';
import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsEdit,
} from '@core/schema/settingsDocuments';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import {editorPreviewFixture} from './editorPreviewFixture';
import type {Song} from '@core/schema/song';
import {importDraftSlides} from './importDraftSlides';

/** Legacy source shape for migration and compatibility helper tests only. */
export function editorLegacySong(number: number): Song {
  const {
    groups: _groups,
    arrangements: _arrangements,
    ...header
  } = editorSong(number).song;
  return {
    ...header,
    schemaVersion: 1,
    ...importDraftSlides(editorSong(number).song),
  };
}

/** Invented source documents for the editor gallery and focused tests. */
export function editorSong(
  number: number,
  access: 'editable' | 'readOnly' = 'editable',
): SongDocument {
  const grouped = editorGroupedSong(number, access);
  const [first, second] = grouped.song.groups;
  if (first === undefined || second === undefined) {
    throw new Error('Invalid grouped editor fixture');
  }
  const parsed = parseSongDocument({
    ...grouped,
    song: {
      ...grouped.song,
      groups: [{...first, slides: first.slides.slice(0, 1)}, second],
      arrangements: [
        {name: '주일용', groups: [first.id, second.id, second.id]},
      ],
    },
  });
  if (!parsed.ok || parsed.value === null) {
    throw new Error('Invalid editor song fixture');
  }
  return parsed.value;
}

export function editorGroupedSong(
  number: number,
  access: 'editable' | 'readOnly' = 'editable',
): EditorSongDocument {
  const g1Id = createSongGroupId(
    `11111111-0000-4000-8000-${String(number).padStart(12, '0')}`,
  );
  const g2Id = createSongGroupId(
    `22222222-0000-4000-8000-${String(number).padStart(12, '0')}`,
  );
  return {
    song: {
      format: 'llsong',
      schemaVersion: 2,
      id: createSongId(
        `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
      ),
      title: `새 노래 ${number}`,
      groups: [
        {
          id: g1Id,
          name: '1절',
          slides: [
            {lines: ['새 아침을 노래해요', '함께 걸어요']},
            {lines: ['맑은 하늘 바라보며']},
          ],
        },
        {
          id: g2Id,
          name: '후렴',
          slides: [{lines: ['빛을 따라가요']}],
        },
      ],
      arrangements: [{name: '주일용', groups: [g1Id, g2Id, g1Id]}],
    },
    revision: 1,
    access,
  };
}

function labelsDocument(document: unknown) {
  const parsed = parseSettingsDocument(document);
  if (!parsed.ok || parsed.value.name !== 'labels') {
    throw new Error('Invalid editor labels fixture');
  }
  return parsed.value;
}

/** Main's checked revision and push ordering, without disk or output commands. */
export function editorFixture() {
  const preview = editorPreviewFixture();
  const first = editorSong(1);
  const second = editorSong(2);
  const documents = new Map(
    [first, second].map(document => [document.song.id, document]),
  );
  const songs = new Set<(change: SongChange) => void>();
  const lists = new Set<(entries: readonly LibrarySong[]) => void>();
  const settings = new Set<(document: SettingsDocument) => void>();
  const edits: ContentEdit[] = [];
  const labelEdits: SettingsEdit[] = [];
  let labels = labelsDocument({
    name: 'labels',
    value: {
      format: 'llsettings.labels',
      schemaVersion: 1,
      labels: [
        {name: '1절', color: 'teal', key: null},
        {name: '후렴', color: 'orange', key: 'KeyC'},
      ],
    },
    revision: 1,
    access: 'editable',
  });
  const refuse = (
    reason: 'not-found' | 'stale' | 'read-only' | 'invalid' | 'duplicate-title',
  ): EditResult => ({ok: false, error: {reason, message: 'Fixture refusal'}});
  const libraryRows = (): readonly LibrarySong[] =>
    [...documents.values()].map(({song, access}) => ({
      id: song.id,
      title: song.title,
      slideCount: sourceSlideCount(song),
      access,
      usedBy: [],
    }));
  const pushList = (entries: readonly LibrarySong[] = libraryRows()): void => {
    for (const listener of lists) listener(entries);
  };
  const pushSong = (document: NonNullable<SongChange['document']>): void => {
    documents.set(document.song.id, document);
    for (const listener of songs) {
      listener({songId: document.song.id, document});
    }
    pushList();
  };
  const api = fakeLlpApi({
    songs: {
      list: () => Promise.resolve(libraryRows()),
      get: id =>
        Promise.resolve(
          [...documents.values()].find(document => document.song.id === id) ??
            null,
        ),
      subscribe: listener => {
        songs.add(listener);
        return () => {
          songs.delete(listener);
        };
      },
      subscribeList: listener => {
        lists.add(listener);
        return () => {
          lists.delete(listener);
        };
      },
    },
    content: {
      edit: async edit => {
        await Promise.resolve();
        edits.push(edit);
        if (
          edit.type === 'song.arrangement.rename' ||
          edit.type === 'song.arrangement.delete'
        ) {
          const current = documents.get(edit.songId);
          if (current === undefined) return refuse('not-found');
          if (current.access === 'readOnly') return refuse('read-only');
          const from =
            edit.type === 'song.arrangement.rename' ? edit.from : edit.name;
          if (!current.song.arrangements?.some(item => item.name === from)) {
            return refuse('not-found');
          }
          if (
            edit.type === 'song.arrangement.rename' &&
            current.song.arrangements.some(item => item.name === edit.to)
          ) {
            return refuse('invalid');
          }
          const parsed = parseSongDocument({
            ...current,
            revision: current.revision + 1,
            song: {
              ...current.song,
              arrangements: current.song.arrangements.flatMap(item =>
                item.name !== from
                  ? [item]
                  : edit.type === 'song.arrangement.delete'
                    ? []
                    : [{...item, name: edit.to}],
              ),
            },
          });
          if (!parsed.ok || parsed.value === null) return refuse('invalid');
          pushSong(parsed.value);
          return {
            ok: true,
            value: {id: edit.songId, revision: parsed.value.revision},
          };
        }
        if (edit.type !== 'song.update') return refuse('invalid');
        const current = documents.get(edit.song.id);
        if (current === undefined) return refuse('not-found');
        if (current.revision !== edit.baseRevision) return refuse('stale');
        if (current.access === 'readOnly') return refuse('read-only');
        if (
          [...documents.values()].some(
            document =>
              document.song.id !== edit.song.id &&
              document.song.title.trim().normalize('NFC') ===
                edit.song.title.trim().normalize('NFC'),
          )
        ) {
          return refuse('duplicate-title');
        }
        const parsed = parseSongDocument({
          ...current,
          song: edit.song,
          revision: current.revision + 1,
        });
        if (!parsed.ok || parsed.value === null) return refuse('invalid');
        pushSong(parsed.value);
        return {
          ok: true,
          value: {id: edit.song.id, revision: parsed.value.revision},
        };
      },
    },
    settings: {
      get: request =>
        Promise.resolve(
          request.name === 'looks'
            ? preview.looks
            : request.name === 'screens'
              ? preview.screens
              : labels,
        ),
      subscribe: listener => {
        settings.add(listener);
        return () => {
          settings.delete(listener);
        };
      },
      edit: async edit => {
        await Promise.resolve();
        labelEdits.push(edit);
        if (edit.name !== 'labels') return refuse('invalid');
        if (edit.baseRevision !== labels.revision) return refuse('stale');
        const value =
          edit.type === 'settings.update'
            ? edit.value
            : {
                ...labels.value,
                labels: labels.value.labels.map(label =>
                  label.name === edit.from ? {...label, name: edit.to} : label,
                ),
              };
        labels = labelsDocument({
          ...labels,
          value,
          revision: labels.revision + 1,
        });
        for (const listener of settings) listener(labels);
        if (edit.type === 'labels.rename') {
          for (const document of documents.values()) {
            if (!document.song.groups.some(group => group.name === edit.from)) {
              continue;
            }
            const parsed = parseSongDocument({
              ...document,
              song: {
                ...document.song,
                groups: document.song.groups.map(group =>
                  group.name === edit.from ? {...group, name: edit.to} : group,
                ),
              },
              revision: document.revision + 1,
            });
            if (parsed.ok && parsed.value !== null) pushSong(parsed.value);
          }
        }
        return {ok: true, value: {id: 'labels', revision: labels.revision}};
      },
    },
  });
  return {
    api,
    first,
    second,
    documents,
    edits,
    labelEdits,
    pushSong,
    pushList,
    pushSettings: (document: SettingsDocument): void => {
      for (const listener of settings) listener(document);
    },
    removeSong: (id: SongDocument['song']['id']): void => {
      documents.delete(id);
      for (const listener of songs) listener({songId: id, document: null});
    },
    labels: () => labels,
    listenerCount: () => songs.size + lists.size + settings.size,
  };
}
