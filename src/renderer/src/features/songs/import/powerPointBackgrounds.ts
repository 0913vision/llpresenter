import type {LlpApi} from '@contracts/ipc/api';
import type {MediaId} from '@core/schema/common/ids';
import type {PowerPointSource} from '@core/schema/songs/powerpointImport';
import {lendPreviewImage} from '@renderer/rendering/media/previewMedia';

/** Most pictures of one request to the main process. */
const BATCH_SIZE = 200;

/**
 * A background picture found in a PowerPoint file: its path, and an id that
 * stands for it in previews.
 */
export interface PowerPointBackground {
  readonly path: string;
  /** Stands for it until it is a file of the media list. */
  readonly preview: MediaId;
}

/**
 * The backgrounds of a PowerPoint import by slide key; `release` frees their
 * previews.
 */
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

/** The media files of pictures of an import, adding the new ones. */
export async function storePowerPointBackgrounds(
  api: LlpApi,
  pictures: readonly PowerPointBackground[],
  title: string,
): Promise<ReadonlyMap<MediaId, MediaId>> {
  const files = new Map<MediaId, MediaId>();
  for (let start = 0; start < pictures.length; start += BATCH_SIZE) {
    const batch = pictures.slice(start, start + BATCH_SIZE);
    const stored = await api.powerpoint.storeImages({
      paths: batch.map(({path}) => path),
      title,
    });
    if (!stored.ok) throw new Error(stored.message);
    for (const [index, {preview}] of batch.entries()) {
      const file = stored.value[index];
      if (file !== undefined) files.set(preview, file);
    }
  }
  return files;
}
