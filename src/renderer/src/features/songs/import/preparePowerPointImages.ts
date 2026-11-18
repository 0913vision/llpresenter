import type {LlpApi} from '@contracts/ipc/api';
import type {PowerPointSource} from '@core/schema/powerpointImport';
import {lendPreviewImage} from '@renderer/rendering/previewMedia';
import {composePowerPointBackground} from './composePowerPointBackground';

const BATCH_SIZE = 200;
type LentImage = NonNullable<ReturnType<typeof lendPreviewImage>>;
interface Entry {
  readonly index: number;
  readonly key: string;
}
interface PrepareOptions {
  readonly active: () => boolean;
  readonly progress: (done: number, total: number) => void;
}

function releaseImages(lent: Map<string, LentImage>): void {
  for (const image of lent.values()) image.release();
  lent.clear();
}

function distinctBackgrounds(slides: PowerPointSource['slides']): Entry[] {
  const seen = new Set<string>();
  return slides.flatMap((slide, index) => {
    if (slide.background === null || seen.has(slide.background)) return [];
    seen.add(slide.background);
    return [{index, key: slide.background}];
  });
}

async function fallback(api: LlpApi, index: number): Promise<Blob> {
  const scene = await api.powerpoint.layers({index});
  if (scene === null) throw new Error('PowerPoint background unavailable');
  const image = await composePowerPointBackground(scene);
  return new Blob([new Uint8Array(image.bytes).buffer], {type: image.mime});
}

async function picture(
  api: LlpApi,
  entry: Entry,
  path: string | undefined,
): Promise<Blob> {
  if (path !== undefined) {
    const image = await api.powerpoint.previewImage({path});
    if (image !== null) {
      return new Blob([new Uint8Array(image.bytes).buffer], {type: image.mime});
    }
  }
  return fallback(api, entry.index);
}

async function releasePaths(
  api: LlpApi,
  paths: readonly string[],
): Promise<void> {
  const results = await Promise.allSettled(
    paths.map(path => api.powerpoint.release({path})),
  );
  for (const result of results) {
    if (result.status === 'rejected' || !result.value) {
      console.error(
        'PowerPoint preview file release failed',
        result.status === 'rejected' ? result.reason : 'not owned',
      );
    }
  }
}

async function prepareBatch({
  api,
  batch,
  lent,
  options,
  report,
}: {
  readonly api: LlpApi;
  readonly batch: readonly Entry[];
  readonly lent: Map<string, LentImage>;
  readonly options: PrepareOptions;
  readonly report: (done: number) => void;
}): Promise<boolean> {
  const unsubscribe = api.powerpoint.subscribeImageProgress(({done}) => {
    const entry = batch[done - 1];
    if (options.active() && entry !== undefined) report(entry.index + 1);
  });
  let paths: Awaited<ReturnType<typeof api.powerpoint.decorationBatch>>;
  try {
    paths = await api.powerpoint.decorationBatch({
      indices: batch.map(entry => entry.index),
    });
  } finally {
    unsubscribe();
  }
  try {
    if (!options.active()) return false;
    const byIndex = new Map(paths?.map(item => [item.index, item.path]) ?? []);
    if (
      paths !== null &&
      (byIndex.size !== batch.length ||
        batch.some(entry => !byIndex.has(entry.index)))
    ) {
      throw new Error('PowerPoint preview batch is incomplete');
    }
    for (const entry of batch) {
      if (!options.active()) return false;
      const blob = await picture(api, entry, byIndex.get(entry.index));
      if (!options.active()) return false;
      const image = lendPreviewImage(blob);
      if (image === null) {
        throw new Error('PowerPoint preview image limit reached');
      }
      lent.set(entry.key, image);
      report(entry.index + 1);
    }
    return options.active();
  } finally {
    await releasePaths(api, paths?.map(item => item.path) ?? []);
  }
}

/** Prepares distinct backgrounds without importing them into the library. */
export async function preparePowerPointImages(
  api: LlpApi,
  slides: PowerPointSource['slides'],
  options: PrepareOptions,
): Promise<{
  readonly ids: ReadonlyMap<string, string>;
  readonly release: () => void;
} | null> {
  const lent = new Map<string, LentImage>();
  const entries = distinctBackgrounds(slides);
  let reported = 0;
  const report = (done: number): void => {
    reported = Math.max(reported, done);
    options.progress(reported, slides.length);
  };
  let complete = false;
  try {
    for (let start = 0; start < entries.length; start += BATCH_SIZE) {
      if (!options.active()) return null;
      const batch = entries.slice(start, start + BATCH_SIZE);
      if (!(await prepareBatch({api, batch, lent, options, report}))) {
        return null;
      }
    }
    if (!options.active()) return null;
    report(slides.length);
    complete = true;
    return {
      ids: new Map([...lent].map(([key, image]) => [key, image.id])),
      release: () => releaseImages(lent),
    };
  } finally {
    if (!complete) releaseImages(lent);
  }
}
