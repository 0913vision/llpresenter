import type {LlpApi} from '@contracts/ipc/api';
import type {PowerPointSource} from '@core/schema/powerpointImport';
import {lendPreviewImage} from '@renderer/rendering/previewMedia';
import {composePowerPointBackground} from './composePowerPointBackground';
import {thumbnailPowerPointImage} from './thumbnailPowerPointImage';

const BATCH_SIZE = 200;

/** The preview cannot hold more temporary image data. */
export class PowerPointPreviewLimitError extends Error {}
type LentImage = NonNullable<ReturnType<typeof lendPreviewImage>>;
interface Entry {
  readonly index: number;
  readonly key: string;
}
export interface PowerPointPreviewProgress {
  readonly done: number;
  readonly total: number;
  readonly phase: 'export' | 'prepare';
  readonly percent: number;
}
interface PrepareOptions {
  readonly active: () => boolean;
  readonly progress: (progress: PowerPointPreviewProgress) => void;
  readonly onImage?: ((key: string, id: string) => void) | undefined;
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
  readonly report: (
    done: number,
    phase: 'export' | 'prepare',
    position: number,
  ) => void;
}): Promise<boolean> {
  let queue = Promise.resolve();
  let failure: Error | undefined;
  const scheduled = new Set<number>();
  const prepare = async (
    entry: Entry,
    path: string | undefined,
    position: number,
  ): Promise<void> => {
    if (!options.active()) return;
    const blob = await picture(api, entry, path);
    if (!options.active()) return;
    const thumbnail = await thumbnailPowerPointImage(blob);
    if (!options.active()) return;
    const hash = await crypto.subtle.digest(
      'SHA-256',
      await thumbnail.arrayBuffer(),
    );
    if (!options.active()) return;
    const contentHash = Array.from(new Uint8Array(hash), value =>
      value.toString(16).padStart(2, '0'),
    ).join('');
    const image = lendPreviewImage(thumbnail, contentHash);
    if (image === null) {
      throw new PowerPointPreviewLimitError(
        'PowerPoint preview image limit reached',
      );
    }
    lent.set(entry.key, image);
    options.onImage?.(entry.key, image.id);
    report(0, 'prepare', position + 1);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  };
  const enqueue = (
    entry: Entry,
    path: string | undefined,
    position: number,
  ): void => {
    scheduled.add(entry.index);
    queue = queue
      .then(() =>
        failure === undefined ? prepare(entry, path, position) : undefined,
      )
      .catch((error: unknown) => {
        failure = error instanceof Error ? error : new Error(String(error));
      });
  };
  const unsubscribe = api.powerpoint.subscribeImageProgress(
    ({done, index, path}) => {
      const entry = batch[done - 1];
      if (options.active() && entry !== undefined) {
        report(0, 'export', done);
        if (
          index === entry.index &&
          path !== undefined &&
          !scheduled.has(index)
        ) {
          enqueue(entry, path, done - 1);
        }
      }
    },
  );
  let paths: Awaited<ReturnType<typeof api.powerpoint.decorationBatch>>;
  try {
    paths = await api.powerpoint.decorationBatch({
      indices: batch.map(entry => entry.index),
    });
  } catch (error) {
    await queue;
    throw error;
  } finally {
    unsubscribe();
  }
  try {
    const byIndex = new Map(paths?.map(item => [item.index, item.path]) ?? []);
    for (const [position, entry] of batch.entries()) {
      if (!scheduled.has(entry.index)) {
        enqueue(entry, byIndex.get(entry.index), position);
      }
    }
    await queue;
    if (failure !== undefined) throw failure;
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
  let complete = false;
  const ready = new Set<string>();
  let reported = -1;
  let reportedPercent = 0;
  const countReady = (): number =>
    slides.filter(
      slide => slide.background === null || ready.has(slide.background),
    ).length;
  try {
    for (let start = 0; start < entries.length;) {
      if (!options.active()) return null;
      const batch = entries.slice(start, start + BATCH_SIZE);
      const report = (
        _done: number,
        phase: 'export' | 'prepare',
        position: number,
      ): void => {
        const step =
          start * 2 + (phase === 'export' ? position : batch.length + position);
        if (phase === 'prepare') {
          const entry = batch[position - 1];
          if (entry) ready.add(entry.key);
        }
        const count = countReady();
        if (phase === 'prepare' || count !== reported) {
          reported = count;
          reportedPercent = Math.max(
            reportedPercent,
            (step / (entries.length * 2)) * 100,
          );
          options.progress({
            done: count,
            total: slides.length,
            phase,
            percent: reportedPercent,
          });
        }
      };
      if (!(await prepareBatch({api, batch, lent, options, report}))) {
        return null;
      }
      start += batch.length;
    }
    if (!options.active()) return null;
    options.progress({
      done: slides.length,
      total: slides.length,
      phase: 'prepare',
      percent: 100,
    });
    complete = true;
    return {
      ids: new Map([...lent].map(([key, image]) => [key, image.id])),
      release: () => releaseImages(lent),
    };
  } finally {
    if (!complete) releaseImages(lent);
  }
}
