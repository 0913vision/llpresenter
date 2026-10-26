import {vi} from 'vitest';
import type {LlpApi} from '@shared/ipc';
import {createMediaId, type MediaId} from '@shared/schema/ids';
import type {
  MediaDocument,
  MediaEdit,
  MediaEditResult,
  MediaImportProgress,
  MediaImportRequest,
  MediaImportResult,
} from '@shared/schema/mediaEdit';
import type {MissingMedia} from '@shared/schema/mediaFiles';
import type {MediaItem} from '@shared/schema/mediaList';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';

export const mediaId = (index: number): MediaId =>
  createMediaId(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);

export function mediaItem(
  index: number,
  item: Partial<MediaItem> = {},
): MediaItem {
  return {
    id: mediaId(index),
    name: `Invented ${index}`,
    kind: 'video',
    file: `invented-${index}.mp4`,
    size: 1024,
    duration: 30,
    ...item,
  };
}

export function mediaDocument(
  items: readonly MediaItem[],
  revision = 1,
): MediaDocument {
  return {
    name: 'media',
    revision,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items,
      playlists: [],
      audioPlaylists: [],
    },
  };
}

/** A media API whose answers a test sets and whose pushes it sends. */
export function mediaFixture(document = mediaDocument([])) {
  const listeners = {
    document: new Set<(document: MediaDocument) => void>(),
    imports: new Set<(progress: MediaImportProgress) => void>(),
    missing: new Set<(missing: MissingMedia) => void>(),
  };
  const follow =
    <T>(set: Set<(value: T) => void>) =>
    (listener: (value: T) => void) => {
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    };
  const edit = vi.fn<(edit: MediaEdit) => Promise<MediaEditResult>>(() =>
    Promise.resolve({ok: true, value: null}),
  );
  const importFiles = vi.fn<
    (request: MediaImportRequest) => Promise<MediaImportResult>
  >(() => Promise.resolve({ok: true, value: []}));
  const write = vi.fn<LlpApi['log']['write']>();
  const send = vi.fn<LlpApi['live']['send']>();
  const api = fakeLlpApi({
    media: {
      get: () => Promise.resolve(document),
      edit,
      import: importFiles,
      subscribe: follow(listeners.document),
      subscribeImports: follow(listeners.imports),
      missing: () => Promise.resolve([]),
      subscribeMissing: follow(listeners.missing),
    },
    log: {write},
    live: {send},
  });
  return {
    api,
    edit,
    importFiles,
    write,
    send,
    listeners,
    pushDocument: (next: MediaDocument) => {
      for (const listener of listeners.document) listener(next);
    },
    pushProgress: (progress: MediaImportProgress) => {
      for (const listener of listeners.imports) listener(progress);
    },
    pushMissing: (missing: MissingMedia) => {
      for (const listener of listeners.missing) listener(missing);
    },
  };
}
