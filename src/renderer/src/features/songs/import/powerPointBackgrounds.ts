import type {LlpApi} from '@contracts/ipc/api';
import type {MediaId} from '@core/schema/ids';
import type {PowerPointSource} from '@core/schema/powerpointImport';
import {powerpointBackgroundName} from '@core/media/powerpointBackground';
import {lendPreviewImage} from '@renderer/rendering/previewMedia';

/** Most pictures one request of the main process exports. */
const BATCH_SIZE = 200;

export interface PowerPointBackground {
  readonly path: string;
  /** Draws it before it is a file of the media list. */
  readonly preview: MediaId;
}

export interface PowerPointBackgrounds {
  /** What each key of a slide stands for. */
  readonly found: ReadonlyMap<string, PowerPointBackground>;
  readonly release: () => void;
}

/** The first slide with each background. */
function distinct(
  slides: PowerPointSource['slides'],
): ReadonlyArray<{readonly key: string; readonly index: number}> {
  const seen = new Set<string>();
  return slides.flatMap(({background}, index) => {
    if (seen.has(background)) return [];
    seen.add(background);
    return [{key: background, index}];
  });
}

async function previewOf(
  api: LlpApi,
  path: string,
): Promise<ReturnType<typeof lendPreviewImage>> {
  const image = await api.powerpoint.previewImage({path});
  return image === null
    ? null
    : lendPreviewImage(
        new Blob([new Uint8Array(image.bytes).buffer], {type: image.mime}),
      );
}

/**
 * Exports what is behind the texts of the slides, each picture once, and tells
 * of every picture as soon as it is there.
 */
export async function exportPowerPointBackgrounds(
  api: LlpApi,
  slides: PowerPointSource['slides'],
  {
    active,
    onFound,
  }: {
    readonly active: () => boolean;
    readonly onFound: (found: PowerPointBackgrounds['found']) => void;
  },
): Promise<PowerPointBackgrounds> {
  const wanted = distinct(slides);
  const keys = new Map(wanted.map(({key, index}) => [index, key]));
  let found: PowerPointBackgrounds['found'] = new Map();
  const images: Array<() => void> = [];
  const paths = new Set<string>();
  const release = (): void => {
    for (const each of images.splice(0)) each();
    for (const path of paths) {
      paths.delete(path);
      api.powerpoint
        .release({path})
        .catch((error: unknown) =>
          console.error('Could not release a PowerPoint picture', error),
        );
    }
  };
  const keep = async (index: number, path: string): Promise<void> => {
    const key = keys.get(index);
    if (key === undefined || paths.has(path)) return;
    paths.add(path);
    const image = await previewOf(api, path);
    if (image === null) return;
    images.push(image.release);
    if (!active()) {
      release();
      return;
    }
    found = new Map([...found, [key, {path, preview: image.id}]]);
    onFound(found);
  };
  const shown: Array<Promise<void>> = [];
  const stop = api.powerpoint.subscribeImageProgress(({picture}) => {
    if (picture !== undefined) shown.push(keep(picture.index, picture.path));
  });
  try {
    for (let start = 0; start < wanted.length; start += BATCH_SIZE) {
      if (!active()) break;
      const files = await api.powerpoint.backgrounds({
        indices: wanted
          .slice(start, start + BATCH_SIZE)
          .map(entry => entry.index),
      });
      for (const {index, path} of files ?? []) shown.push(keep(index, path));
    }
    await Promise.all(shown);
  } finally {
    stop();
  }
  return {found, release};
}

/** Adds a picture file to the media list, named after the song. */
async function addToMedia(
  api: LlpApi,
  path: string,
  title: string,
): Promise<MediaId> {
  const phases = new Map<string, string>();
  let changed: (() => void) | undefined;
  const stop = api.media.subscribeImports(event => {
    phases.set(event.mediaId, event.phase);
    changed?.();
  });
  try {
    const result = await api.media.import({
      source: {kind: 'files', paths: [path]},
      playlist: null,
    });
    const job = result.ok ? result.value[0] : undefined;
    if (
      job === undefined ||
      job.phase === 'failed' ||
      job.phase === 'cancelled'
    ) {
      throw new Error('Background import failed');
    }
    const id = job.mediaId;
    if (job.phase !== 'complete') {
      await new Promise<void>((resolve, reject) => {
        const check = (): void => {
          const phase = phases.get(id);
          if (phase === 'complete') resolve();
          else if (phase === 'failed' || phase === 'cancelled') {
            reject(new Error('Background import failed'));
          }
        };
        changed = check;
        check();
      });
    }
    await nameMedia(api, id, title);
    return id;
  } finally {
    stop();
  }
}

async function nameMedia(
  api: LlpApi,
  id: MediaId,
  title: string,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const document = await api.media.get();
    const name = powerpointBackgroundName(
      title,
      document.value.items
        .filter(item => item.id !== id)
        .map(item => item.name),
    );
    const renamed = await api.media.edit({
      type: 'media.properties.update',
      mediaId: id,
      changes: {name},
      baseRevision: document.revision,
    });
    if (renamed.ok || renamed.error.reason !== 'stale') return;
  }
}

/** The media files of the backgrounds a song uses, adding the new ones. */
export async function importPowerPointBackgrounds(
  api: LlpApi,
  keys: ReadonlySet<string>,
  {
    found,
    title,
  }: {
    readonly found: PowerPointBackgrounds['found'];
    readonly title: string;
  },
): Promise<ReadonlyMap<string, MediaId>> {
  const media = new Map<string, MediaId>();
  for (const key of keys) {
    const background = found.get(key);
    if (background === undefined) continue;
    const {path} = background;
    media.set(
      key,
      (await api.powerpoint.match({path})) ??
        (await addToMedia(api, path, title)),
    );
  }
  return media;
}
