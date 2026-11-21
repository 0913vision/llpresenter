import type {LlpApi} from '@contracts/ipc/api';
import type {PowerPointSource} from '@core/schema/powerpointImport';
import {lendPreviewImage} from '@renderer/rendering/previewMedia';
import {composePowerPointBackground} from './composePowerPointBackground';
import {thumbnailPowerPointImage} from './thumbnailPowerPointImage';
import {
  POWERPOINT_BACKGROUND_LIMITS,
  type PowerPointScene,
} from '@core/songs/powerpointLayers';

const BATCH_SIZE = 200;
const RETAIN_LIMIT = POWERPOINT_BACKGROUND_LIMITS.totalImageBytes;

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
  readonly previews?: boolean;
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

/** Only use ZIP images where the complete background is a plain full-slide picture. */
function simplePicture(scene: PowerPointScene): boolean {
  if (scene.skipped !== 0 || scene.pictures.length !== 1) return false;
  const picture = scene.layers.at(-1);
  if (picture?.kind !== 'picture' || scene.layers.length > 2) {
    return false;
  }
  if (scene.layers.length === 2) {
    const base = scene.layers[0];
    if (
      base?.kind !== 'shape' ||
      base.geometry !== 'rect' ||
      base.fill?.kind !== 'solid' ||
      base.outline !== null
    ) {
      return false;
    }
  }
  const {a, b, c, d, e, f} = picture.matrix;
  const near = (left: number, right: number): boolean =>
    Math.abs(left - right) < 0.01;
  return (
    near(Math.abs(a), 1920) &&
    near(Math.abs(d), 1080) &&
    near(b, 0) &&
    near(c, 0) &&
    near(e, a < 0 ? 1920 : 0) &&
    near(f, d < 0 ? 1080 : 0) &&
    picture.alpha === 1 &&
    picture.brightness === 0 &&
    picture.contrast === 0 &&
    !picture.grayscale &&
    !picture.tile &&
    (picture.geometry === undefined || picture.geometry === 'rect') &&
    Object.values(picture.crop).every(value => value === 0) &&
    Object.values(picture.stretch).every(value => value === 0)
  );
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

async function previewImage(
  blob: Blob,
  active: () => boolean,
): Promise<LentImage | null> {
  const thumbnail = await thumbnailPowerPointImage(blob);
  if (!active()) return null;
  const hash = await crypto.subtle.digest(
    'SHA-256',
    await thumbnail.arrayBuffer(),
  );
  if (!active()) return null;
  const contentHash = Array.from(new Uint8Array(hash), value =>
    value.toString(16).padStart(2, '0'),
  ).join('');
  const image = lendPreviewImage(thumbnail, contentHash);
  if (image === null) {
    throw new PowerPointPreviewLimitError(
      'PowerPoint preview image limit reached',
    );
  }
  return image;
}

async function prepareBatch({
  api,
  batch,
  lent,
  options,
  report,
  full,
  simpleCache,
}: {
  readonly api: LlpApi;
  readonly batch: readonly Entry[];
  readonly lent: Map<string, LentImage>;
  readonly options: PrepareOptions;
  readonly full: Map<string, Blob>;
  readonly simpleCache: Map<string, Blob>;
  readonly report: (
    done: number,
    phase: 'export' | 'prepare',
    position: number,
  ) => void;
}): Promise<boolean> {
  const direct = new Map<number, Blob>();
  for (const entry of batch) {
    if (!options.active()) return false;
    const scene = await api.powerpoint
      .layers({index: entry.index})
      .catch(() => null);
    if (!scene || !simplePicture(scene)) continue;
    const key = JSON.stringify(scene.layers);
    let blob = simpleCache.get(key);
    if (!blob) {
      try {
        const image = await composePowerPointBackground(scene);
        blob = new Blob([new Uint8Array(image.bytes).buffer], {
          type: image.mime,
        });
      } catch {
        continue;
      }
      const used = [...simpleCache.values()].reduce(
        (sum, value) => sum + value.size,
        0,
      );
      if (used + blob.size > RETAIN_LIMIT) continue;
      simpleCache.set(key, blob);
    }
    direct.set(entry.index, blob);
  }
  const pending = batch.filter(entry => !direct.has(entry.index));
  const unsubscribe = api.powerpoint.subscribeImageProgress(({done}) => {
    const entry = pending[done - 1];
    if (options.active() && entry !== undefined) {
      report(0, 'export', done);
    }
  });
  let paths: Awaited<ReturnType<typeof api.powerpoint.decorationBatch>>;
  try {
    paths = pending.length
      ? await api.powerpoint.decorationBatch({
          indices: pending.map(entry => entry.index),
        })
      : null;
  } finally {
    unsubscribe();
  }
  try {
    if (!options.active()) return false;
    const byIndex = new Map(paths?.map(item => [item.index, item.path]) ?? []);
    for (const [position, entry] of batch.entries()) {
      if (!options.active()) return false;
      const blob =
        direct.get(entry.index) ??
        (await picture(api, entry, byIndex.get(entry.index)));
      if (!options.active()) return false;
      if (
        [...new Set(full.values())].reduce(
          (total, value) => total + value.size,
          0,
        ) +
          (new Set(full.values()).has(blob) ? 0 : blob.size) <=
        RETAIN_LIMIT
      ) {
        full.set(entry.key, blob);
      }
      if (options.previews === false) {
        report(0, 'prepare', position + 1);
        continue;
      }
      const image = await previewImage(blob, options.active);
      if (image === null) return false;
      lent.set(entry.key, image);
      report(0, 'prepare', position + 1);
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
  readonly full: ReadonlyMap<string, Blob>;
  readonly release: () => void;
} | null> {
  const lent = new Map<string, LentImage>();
  const full = new Map<string, Blob>();
  const simpleCache = new Map<string, Blob>();
  const entries = distinctBackgrounds(slides);
  let complete = false;
  const ready = new Set<string>();
  let reported = -1;
  const countReady = (): number =>
    slides.filter(
      slide => slide.background === null || ready.has(slide.background),
    ).length;
  try {
    for (let start = 0; start < entries.length; start += BATCH_SIZE) {
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
          options.progress({
            done: count,
            total: slides.length,
            phase,
            percent: (step / (entries.length * 2)) * 100,
          });
        }
      };
      if (
        !(await prepareBatch({
          api,
          batch,
          lent,
          options,
          report,
          full,
          simpleCache,
        }))
      ) {
        return null;
      }
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
      full,
      release: () => releaseImages(lent),
    };
  } finally {
    if (!complete) releaseImages(lent);
  }
}
