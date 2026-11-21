import {useEffect, useEffectEvent} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {PowerPointSource} from '@core/schema/powerpointImport';
import type {TextImportDraft} from '@core/schema/textImport';
import {
  powerpointDarkLyrics,
  powerpointSlides,
} from '@core/songs/powerpointSlides';
import {LIGHT_SONG_THEME_ID} from '@core/themes/lightSong';
import {powerpointBackgroundIndex} from '@core/songs/powerpointBackgroundIndex';
import {powerpointBackgroundName} from '@core/media/powerpointBackground';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {SongEditorStore} from '../editor/songEditorStore';
import {composePowerPointBackground} from './composePowerPointBackground';
import {preparePowerPointImages} from './preparePowerPointImages';

async function importBackground(
  api: LlpApi,
  path: string,
  title: string,
): Promise<NonNullable<TextImportDraft['background']>> {
  const events = new Map<string, string>();
  let notify: (() => void) | undefined;
  const unsubscribe = api.media.subscribeImports(event => {
    events.set(event.mediaId, event.phase);
    notify?.();
  });
  try {
    const result = await api.media.import({
      source: {kind: 'files', paths: [path]},
      playlist: null,
    });
    if (!result.ok || !result.value[0]) {
      throw new Error('Background import failed');
    }
    const job = result.value[0];
    if (job.phase === 'failed' || job.phase === 'cancelled') {
      throw new Error('Background import failed');
    }
    const id = job.mediaId;
    if (job.phase !== 'complete') {
      await new Promise<void>((resolve, reject) => {
        const check = (): void => {
          const phase = events.get(id);
          if (phase === 'complete') resolve();
          else if (phase === 'failed' || phase === 'cancelled') {
            reject(new Error('Background import failed'));
          }
        };
        notify = check;
        check();
      });
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const document = await api.media.get();
      if (!document.value.items.some(item => item.id === id)) {
        throw new Error('Imported background is unavailable');
      }
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
      if (renamed.ok || renamed.error.reason === 'write-failed') return id;
      if (renamed.error.reason !== 'stale') {
        throw new Error('Background rename failed');
      }
    }
    throw new Error('Background rename failed');
  } finally {
    unsubscribe();
  }
}

let backgroundQueue: Promise<void> = Promise.resolve();

async function importSelectedBackground(
  api: LlpApi,
  {
    index,
    title,
    decoration,
    isActive,
    exporting,
    prepared,
  }: {
    readonly index: number;
    readonly title: string;
    readonly decoration: boolean;
    readonly isActive: () => boolean;
    readonly exporting: {current: boolean};
    readonly prepared?: Blob | undefined;
  },
): Promise<TextImportDraft['background']> {
  const previous = backgroundQueue;
  let unlock: () => void = () => undefined;
  backgroundQueue = new Promise<void>(resolve => {
    unlock = resolve;
  });
  try {
    await previous;
    if (!isActive()) return undefined;
    let path: string | null = null;
    if (
      prepared &&
      (prepared.type === 'image/png' || prepared.type === 'image/jpeg')
    ) {
      path = await api.powerpoint.background({
        index,
        image: {
          mime: prepared.type,
          bytes: new Uint8Array(await prepared.arrayBuffer()),
        },
      });
    } else if (decoration) {
      exporting.current = true;
      try {
        path = await api.powerpoint.background({index, decoration: true});
      } finally {
        exporting.current = false;
      }
    }
    if (!isActive()) {
      if (path !== null) await api.powerpoint.release({path});
      return undefined;
    }
    if (path === null && decoration) return undefined;
    if (path === null) {
      const scene = await api.powerpoint.layers({index});
      if (!isActive()) return undefined;
      if (!scene) throw new Error('Background layers unavailable');
      const image = await composePowerPointBackground(scene);
      if (!isActive()) return undefined;
      path = await api.powerpoint.background({index, image});
    }
    if (!path) throw new Error('Background unavailable');
    try {
      if (!isActive()) return undefined;
      const existing = await api.powerpoint.match({path});
      if (!isActive()) return undefined;
      return existing ?? (await importBackground(api, path, title));
    } finally {
      await api.powerpoint.release({path});
    }
  } finally {
    unlock();
  }
}

async function importBackgrounds(
  api: LlpApi,
  {
    range,
    start,
    title,
    isActive,
    exporting,
    full,
  }: {
    readonly range: PowerPointSource['slides'];
    readonly start: number;
    readonly title: string;
    readonly isActive: () => boolean;
    readonly exporting: {current: boolean};
    readonly full: ReadonlyMap<string, Blob>;
  },
): Promise<Map<string, NonNullable<TextImportDraft['background']>>> {
  const pictures = new Map<
    string,
    NonNullable<TextImportDraft['background']>
  >();
  for (const [index, slide] of range.entries()) {
    if (slide.background === null || pictures.has(slide.background)) continue;
    let picture = await importSelectedBackground(api, {
      index: start + index,
      title,
      decoration: true,
      isActive,
      exporting,
      prepared: full.get(slide.background),
    });
    if (!isActive()) break;
    picture ??= await importSelectedBackground(api, {
      index: start + index,
      title,
      decoration: false,
      isActive,
      exporting,
    });
    if (picture !== undefined) pictures.set(slide.background, picture);
  }
  return pictures;
}

/** Reads every slide and opens an unsaved song without an import dialog. */
export function PowerPointImportFlow({
  api,
  store,
  onDone,
  onEdit,
  onProblem,
}: {
  readonly api: LlpApi;
  readonly store: SongEditorStore;
  readonly onDone: () => void;
  readonly onEdit: () => void;
  readonly onProblem: (notice: Notice) => void;
}): null {
  const done = useEffectEvent(() => onDone());
  const edit = useEffectEvent(() => onEdit());
  const problem = useEffectEvent((notice: Notice) => onProblem(notice));
  useEffect(() => {
    let active = true;
    const isActive = (): boolean => active;
    let preparing = false;
    let prepared: Awaited<ReturnType<typeof preparePowerPointImages>> = null;
    const exporting = {current: false};
    const originalSession = store.getSnapshot().session;
    const finish = (): void => {
      if (!isActive()) return;
      done();
    };
    const run = async (): Promise<void> => {
      try {
        const result = await api.powerpoint.read();
        if (!isActive()) return;
        if (!result.ok) {
          problem({
            key: 'powerpoint:read',
            kind: 'warning',
            icon: 'warning',
            title: result.message,
            time: noticeTime(),
          });
          finish();
          return;
        }
        if (result.value === null) {
          finish();
          return;
        }
        const source = result.value;
        const range = source.slides;
        const slides = powerpointSlides(range);
        if (slides.length === 0) throw new Error('PowerPoint has no slides');
        const titleIndex = slides.findIndex(
          slide => 'titleSlide' in slide && slide.titleSlide,
        );
        const shapeTitle = range[titleIndex]?.shapes[0]?.lines
          .map(line => line.trim())
          .filter(Boolean)
          .join(' ');
        const title =
          shapeTitle === undefined || shapeTitle === ''
            ? source.fileName.replace(/\.[^.]+$/, '')
            : shapeTitle;
        let pictures = new Map<
          string,
          NonNullable<TextImportDraft['background']>
        >();
        const winner = powerpointBackgroundIndex(range);
        if (winner !== undefined) {
          preparing = true;
          const result = await preparePowerPointImages(api, range, {
            active: isActive,
            progress: () => undefined,
            previews: false,
          });
          preparing = false;
          if (!isActive()) {
            result?.release();
            return;
          }
          if (result === null) {
            finish();
            return;
          }
          prepared = result;
          pictures = await importBackgrounds(api, {
            range,
            start: 0,
            title,
            isActive,
            exporting,
            full: result.full,
          });
        }
        if (!isActive()) return;
        const key =
          winner === undefined ? undefined : range[winner]?.background;
        const background = key == null ? undefined : pictures.get(key);
        const draft: TextImportDraft = {
          title,
          slides: slides.map((slide, index) => {
            const key = range[index]?.background;
            const picture = key == null ? undefined : pictures.get(key);
            return picture === undefined ? slide : {...slide, picture};
          }),
          preserveSlides: true,
          ...(powerpointDarkLyrics(range) ? {theme: LIGHT_SONG_THEME_ID} : {}),
          ...(background === undefined ? {} : {background}),
        };
        if (
          store.getSnapshot().session !== originalSession ||
          store.getSnapshot().imported
        ) {
          problem({
            key: 'powerpoint:changed',
            kind: 'warning',
            icon: 'warning',
            title: '곡이 바뀌어 PowerPoint를 열지 못했습니다',
            time: noticeTime(),
          });
          finish();
          return;
        }
        store.openImported(draft);
        if (store.getSnapshot().session === originalSession) {
          throw new Error('PowerPoint song could not open');
        }
        edit();
        finish();
      } catch (error) {
        if (!isActive()) return;
        console.error('PowerPoint import failed:', error);
        problem({
          key: 'powerpoint:import',
          kind: 'warning',
          icon: 'warning',
          title: 'PowerPoint 가져오기 실패',
          time: noticeTime(),
        });
        finish();
      }
    };
    const timer = setTimeout(() => {
      run().catch((error: unknown) =>
        console.error('PowerPoint import failed:', error),
      );
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
      prepared?.release();
      if (preparing || exporting.current) {
        void api.powerpoint.cancelImages().catch(() => undefined);
      }
      void api.powerpoint.cancelRead().catch(() => undefined);
    };
  }, [api, store]);
  return null;
}
