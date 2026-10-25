import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {createSongId} from '@shared/schema/ids';
import {
  parseSongDocument,
  type SongChange,
  type LibrarySong,
  type SongDocument,
} from '@shared/schema/contentDocuments';
import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsEdit,
} from '@shared/schema/settingsDocuments';
import type {ContentEdit, EditResult} from '@shared/schema/contentEdit';

/** Invented source documents for the editor gallery and focused tests. */
export function editorSong(
  number: number,
  access: 'editable' | 'readOnly' = 'editable',
): SongDocument {
  const parsed = parseSongDocument({
    song: {
      format: 'llsong',
      schemaVersion: 1,
      id: createSongId(
        `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
      ),
      title: `새 노래 ${number}`,
      slides: [
        {label: '1절', lines: ['새 아침을 노래해요', '함께 걸어요']},
        {label: '후렴', lines: ['빛을 따라가요']},
      ],
      arrangements: [{name: '주일용', slides: [1, 2, 2]}],
    },
    revision: 1,
    access,
  });
  if (!parsed.ok || parsed.value === null) {
    throw new Error('Invalid editor song fixture');
  }
  return parsed.value;
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
    reason: 'not-found' | 'stale' | 'read-only' | 'invalid',
  ): EditResult => ({ok: false, error: {reason, message: 'Fixture refusal'}});
  const pushSong = (document: NonNullable<SongChange['document']>): void => {
    documents.set(document.song.id, document);
    for (const listener of songs) {
      listener({songId: document.song.id, document});
    }
  };
  const api = fakeLlpApi({
    songs: {
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
        if (edit.type !== 'song.update') return refuse('invalid');
        const current = documents.get(edit.song.id);
        if (current === undefined) return refuse('not-found');
        if (current.revision !== edit.baseRevision) return refuse('stale');
        if (current.access === 'readOnly') return refuse('read-only');
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
      get: () => Promise.resolve(labels),
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
            if (
              !document.song.slides.some(slide => slide.label === edit.from)
            ) {
              continue;
            }
            const parsed = parseSongDocument({
              ...document,
              song: {
                ...document.song,
                slides: document.song.slides.map(slide =>
                  slide.label === edit.from
                    ? {...slide, label: edit.to}
                    : slide,
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
    removeSong: (id: SongDocument['song']['id']): void => {
      documents.delete(id);
      for (const listener of songs) listener({songId: id, document: null});
    },
    labels: () => labels,
    listenerCount: () => songs.size + lists.size + settings.size,
  };
}
