import {Suspense, useEffect, useMemo, useRef, useState, type JSX} from 'react';
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
import {Dialog, DialogBox} from '@renderer/ui/Dialog';
import {Checkbox, Progress, TextField} from '@renderer/ui';
import {ThumbnailSizeControl} from '@renderer/ui/ThumbnailSizeControl';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {SongEditorStore} from '../editor/songEditorStore';
import styles from './PowerPointImport.module.css';
import {composePowerPointBackground} from './composePowerPointBackground';
import {
  preparePowerPointImages,
  PowerPointPreviewLimitError,
  type PowerPointPreviewProgress,
} from './preparePowerPointImages';
import {powerPointPictureSpecs} from './powerPointPictureSpecs';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {useApiSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {PowerPointPreviewGrid} from './PowerPointPreviewGrid';
import {PictureService} from '@renderer/rendering/pictures/pictureService';

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
  }: {
    readonly index: number;
    readonly title: string;
    readonly decoration: boolean;
    readonly isActive: () => boolean;
    readonly exporting: {current: boolean};
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
    if (decoration) {
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
    indices,
    title,
    isActive,
    exporting,
  }: {
    readonly range: PowerPointSource['slides'];
    readonly indices: readonly number[];
    readonly title: string;
    readonly isActive: () => boolean;
    readonly exporting: {current: boolean};
  },
): Promise<Map<string, NonNullable<TextImportDraft['background']>>> {
  const pictures = new Map<
    string,
    NonNullable<TextImportDraft['background']>
  >();
  for (const [index, slide] of range.entries()) {
    if (slide.background === null || pictures.has(slide.background)) continue;
    let picture = await importSelectedBackground(api, {
      index: indices[index] ?? index,
      title,
      decoration: true,
      isActive,
      exporting,
    });
    if (!isActive()) break;
    picture ??= await importSelectedBackground(api, {
      index: indices[index] ?? index,
      title,
      decoration: false,
      isActive,
      exporting,
    });
    if (picture !== undefined) pictures.set(slide.background, picture);
  }
  return pictures;
}

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
}): JSX.Element | null {
  const [source, setSource] = useState<PowerPointSource | null>(null);
  const pending = useRef<ReturnType<typeof api.powerpoint.read> | null>(null);
  const cancelled = useRef(false);
  useEffect(() => {
    let active = true;
    pending.current ??= api.powerpoint.read();
    pending.current
      .then(result => {
        if (!active || cancelled.current) return;
        if (!result.ok) {
          onProblem({
            key: 'powerpoint:read',
            kind: 'warning',
            icon: 'warning',
            title: result.message,
            time: noticeTime(),
          });
          onDone();
        } else if (result.value === null) onDone();
        else setSource(result.value);
      })
      .catch(() => {
        if (active && !cancelled.current) {
          onProblem({
            key: 'powerpoint:read',
            kind: 'warning',
            icon: 'warning',
            title: 'PowerPoint 가져오기 실패',
            time: noticeTime(),
          });
          onDone();
        }
      });
    return () => {
      active = false;
    };
  }, [api, onDone, onProblem]);
  if (!source) {
    return (
      <Dialog
        title="PowerPoint 가져오기"
        size="s"
        onCancel={() => {
          cancelled.current = true;
          api.powerpoint
            .cancelRead()
            .catch((error: unknown) =>
              console.error('PowerPoint read cancellation failed:', error),
            );
          onDone();
        }}
        primary={{label: '가져오기', disabled: true, onSelect: () => undefined}}
      >
        <Progress value={null} label="PowerPoint 읽는 중" />
      </Dialog>
    );
  }
  return (
    <PowerPointPreparing
      api={api}
      store={store}
      source={source}
      onDone={onDone}
      onEdit={onEdit}
      onProblem={onProblem}
    />
  );
}

function PowerPointPreparing({
  api,
  store,
  source,
  onDone,
  onEdit,
  onProblem,
}: {
  readonly api: LlpApi;
  readonly store: SongEditorStore;
  readonly source: PowerPointSource;
  readonly onDone: () => void;
  readonly onEdit: () => void;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const [prepared, setPrepared] =
    useState<Awaited<ReturnType<typeof preparePowerPointImages>>>(null);
  const [previewImages, setPreviewImages] = useState<
    ReadonlyMap<string, string>
  >(() => new Map());
  const [progress, setProgress] = useState<PowerPointPreviewProgress>({
    done: 0,
    total: source.slides.length,
    phase: 'export',
    percent: 0,
  });
  const [pictures] = useState(() => new PictureService({waitForReady: true}));
  useEffect(() => () => pictures.reset(), [pictures]);
  const cancelled = useRef(false);
  const [themesFailed, setThemesFailed] = useState(false);
  const [screensFailed, setScreensFailed] = useState(false);
  const themes = useApiSettingsDocument({
    api,
    name: 'themes',
    title: '테마',
    onProblem: notice => {
      setThemesFailed(true);
      onProblem(notice);
    },
  });
  const screens = useApiSettingsDocument({
    api,
    name: 'screens',
    title: '화면',
    onProblem: notice => {
      setScreensFailed(true);
      onProblem(notice);
    },
  });
  useEffect(() => {
    let active = true;
    let release: (() => void) | undefined;
    let preparing = false;
    const timer = setTimeout(() => {
      preparing = true;
      void preparePowerPointImages(api, source.slides, {
        active: () => active && !cancelled.current,
        onImage: (key, id) => {
          if (active && !cancelled.current) {
            setPreviewImages(current => new Map(current).set(key, id));
          }
        },
        progress: next => {
          if (active && !cancelled.current) setProgress(next);
        },
      })
        .then(result => {
          preparing = false;
          if (!active || cancelled.current) {
            result?.release();
            return;
          }
          if (result === null) {
            onDone();
            return;
          }
          release = result.release;
          setPrepared(result);
        })
        .catch((error: unknown) => {
          preparing = false;
          if (!active || cancelled.current) return;
          console.error('PowerPoint preview preparation failed:', error);
          onProblem({
            key: 'powerpoint:preview',
            kind: 'warning',
            icon: 'warning',
            title:
              error instanceof PowerPointPreviewLimitError
                ? 'PowerPoint 미리보기 용량 초과'
                : 'PowerPoint 미리보기 실패',
            time: noticeTime(),
          });
          onDone();
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
      if (preparing) {
        api.powerpoint
          .cancelImages()
          .catch((error: unknown) =>
            console.error('PowerPoint preview cancellation failed:', error),
          );
      }
      release?.();
    };
  }, [api, source, onDone, onProblem]);
  const loading = (
    <Dialog
      title="PowerPoint 가져오기"
      size="s"
      onCancel={() => {
        cancelled.current = true;
        onDone();
      }}
      primary={{
        label: '\uac00\uc838\uc624\uae30',
        disabled: true,
        onSelect: () => undefined,
      }}
    >
      <Progress
        value={progress.percent}
        label={
          progress.phase === 'export'
            ? 'PowerPoint \uc7a5\uc2dd \ub0b4\ubcf4\ub0b4\uae30'
            : 'PowerPoint \ubbf8\ub9ac\ubcf4\uae30 \uc900\ube44'
        }
        valueText={`${progress.done} / ${progress.total}`}
      />
    </Dialog>
  );
  if (
    (themes === null && !themesFailed) ||
    (screens === null && !screensFailed)
  ) {
    return loading;
  }
  return (
    <Suspense fallback={loading}>
      <PowerPointDialog
        api={api}
        store={store}
        source={source}
        images={prepared?.ids ?? previewImages}
        preparing={prepared === null}
        progress={progress}
        pictures={pictures}
        onDone={onDone}
        onEdit={onEdit}
        onProblem={onProblem}
      />
    </Suspense>
  );
}

function PowerPointDialog({
  api,
  store,
  source,
  images,
  preparing,
  progress,
  pictures,
  onDone,
  onEdit,
  onProblem,
}: {
  readonly api: LlpApi;
  readonly store: SongEditorStore;
  readonly source: PowerPointSource;
  readonly images: ReadonlyMap<string, string>;
  readonly preparing: boolean;
  readonly progress: PowerPointPreviewProgress;
  readonly pictures: PictureService;
  readonly onDone: () => void;
  readonly onEdit: () => void;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const [anchor, setAnchor] = useState(0);
  const [selected, setSelected] = useState<ReadonlySet<number>>(
    () => new Set(source.slides.map((_, index) => index)),
  );
  const [scale, setScale] = useState(100);
  const [title, setTitle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lyrics, setLyrics] = useState(true);
  const backgroundAvailable =
    source.widescreen && source.slides.some(slide => slide.background !== null);
  const [background, setBackground] = useState(backgroundAvailable);
  const [replacement, setReplacement] = useState<TextImportDraft | null>(null);
  const active = useRef(true);
  const exporting = useRef(false);
  useEffect(() => {
    const currentExport = exporting;
    active.current = true;
    return () => {
      active.current = false;
      if (currentExport.current) {
        currentExport.current = false;
        api.powerpoint.cancelImages().catch(() => undefined);
      }
    };
  }, [api]);
  const indices = useMemo(
    () => [...selected].sort((a, b) => a - b),
    [selected],
  );
  const start = indices[0] ?? 0;
  const finish = indices.at(-1) ?? 0;
  const range = useMemo(
    () =>
      indices.flatMap(index =>
        source.slides[index] ? [source.slides[index]] : [],
      ),
    [source, indices],
  );
  const slides = useMemo(() => powerpointSlides(range), [range]);
  const titleIndex = slides.findIndex(
    slide => 'titleSlide' in slide && slide.titleSlide,
  );
  const titleLines = range[titleIndex]?.shapes[0]?.lines;
  const shapeTitle = titleLines
    ?.map(line => line.trim())
    .filter(Boolean)
    .join(' ');
  let defaultTitle = source.fileName.replace(/\.[^.]+$/, '');
  if (shapeTitle !== undefined && shapeTitle.length > 0) {
    defaultTitle = shapeTitle;
  }
  const shownTitle = title ?? defaultTitle;
  const theme = useSlideTheme(
    {
      id: 'powerpoint-import',
      kind: 'song',
      title: shownTitle,
      ...(powerpointDarkLyrics(range) ? {theme: LIGHT_SONG_THEME_ID} : {}),
    },
    'service',
    {api},
  );
  const specs =
    theme === undefined
      ? []
      : powerPointPictureSpecs(source.slides, background ? images : new Map(), {
          ...theme,
          mediaOnly: !lyrics,
          selection: {start, end: finish, indices},
        });
  const defaultBackground =
    range[powerpointBackgroundIndex(range) ?? -1]?.background;
  const edit = (draft: TextImportDraft): void => {
    const previous = store.getSnapshot().session;
    store.openImported(draft);
    if (store.getSnapshot().session !== previous) {
      onEdit();
      onDone();
    }
  };
  const create = async (): Promise<void> => {
    setBusy(true);
    try {
      const winner = powerpointBackgroundIndex(range);
      let importedBackground: TextImportDraft['background'];
      let pictures = new Map<
        string,
        NonNullable<TextImportDraft['background']>
      >();
      if (background && winner !== undefined) {
        const decorated = await importBackgrounds(api, {
          range,
          indices,
          title: shownTitle,
          isActive: () => active.current,
          exporting,
        });
        if (!active.current) return;
        pictures = decorated;
        const key = range[winner]?.background;
        importedBackground =
          key === null || key === undefined ? undefined : pictures.get(key);
      }
      if (!active.current) return;
      if (!lyrics) {
        onDone();
        return;
      }
      const draft: TextImportDraft = {
        title: shownTitle,
        slides: slides.map((slide, index) => {
          const key = range[index]?.background;
          const picture =
            key === null || key === undefined ? undefined : pictures.get(key);
          return picture === undefined ? slide : {...slide, picture};
        }),
        preserveSlides: true,
        ...(powerpointDarkLyrics(range) ? {theme: LIGHT_SONG_THEME_ID} : {}),
        ...(importedBackground === undefined
          ? {}
          : {background: importedBackground}),
      };
      if (store.getSnapshot().imported) setReplacement(draft);
      else edit(draft);
    } catch {
      if (active.current) {
        onProblem({
          key: 'powerpoint:edit',
          kind: 'warning',
          icon: 'warning',
          title: 'PowerPoint 가져오기 실패',
          time: noticeTime(),
        });
      }
    } finally {
      if (active.current) setBusy(false);
    }
  };
  return (
    <>
      <Dialog
        title="PowerPoint 가져오기"
        size="xl"
        subtitle={{icon: 'filetext', text: source.fileName}}
        onCancel={() => {
          active.current = false;
          if (exporting.current) {
            exporting.current = false;
            api.powerpoint.cancelImages().catch(() => undefined);
          }
          onDone();
        }}
        cancelLabel="저장 안 함"
        primary={{
          label: lyrics ? '편집' : '가져오기',
          disabled:
            busy ||
            preparing ||
            slides.length === 0 ||
            (!lyrics && powerpointBackgroundIndex(range) === undefined),
          onSelect: () => {
            create().catch(() => undefined);
          },
        }}
      >
        <div className={styles.content}>
          <div className={styles.title}>
            <TextField
              aria-label="제목"
              block
              value={shownTitle}
              onChange={setTitle}
            />
            <span>슬라이드 {slides.length}</span>
            <label className={styles.option}>
              <Checkbox
                aria-label="가사"
                checked={lyrics}
                onChange={value => {
                  if (value || background) setLyrics(value);
                }}
              />
              가사
            </label>
            <label className={styles.option}>
              <Checkbox
                aria-label="배경"
                checked={background}
                disabled={!backgroundAvailable}
                title={
                  source.widescreen
                    ? '선택한 슬라이드에서 가장 많이 사용된 배경'
                    : '16:9 슬라이드만'
                }
                onChange={value => {
                  if (value || lyrics) setBackground(value);
                }}
              />
              배경
            </label>
          </div>
          <DialogBox
            title="슬라이드"
            meta={
              preparing
                ? `${progress.done} / ${progress.total}`
                : `${selected.size} / ${source.slides.length}`
            }
            checkAll={{
              checked:
                selected.size === 0
                  ? false
                  : selected.size === source.slides.length
                    ? true
                    : 'mixed',
              onChange: checked =>
                setSelected(
                  new Set(
                    checked ? source.slides.map((_, index) => index) : [],
                  ),
                ),
            }}
            headerEnd={
              <ThumbnailSizeControl value={scale} onChange={setScale} compact />
            }
          >
            <PowerPointPreviewGrid
              slides={source.slides}
              specs={specs}
              service={pictures}
              start={start}
              end={finish}
              selected={selected}
              scale={scale}
              isReady={index => {
                if (!background) return true;
                const key =
                  source.slides[index]?.background ?? defaultBackground;
                return key === null || key === undefined || images.has(key);
              }}
              onSelectAll={() =>
                setSelected(new Set(source.slides.map((_, index) => index)))
              }
              onToggle={index =>
                setSelected(current => {
                  const next = new Set(current);
                  if (next.has(index)) next.delete(index);
                  else next.add(index);
                  return next;
                })
              }
              onSelect={(index, shift) => {
                setSelected(() => {
                  const next = new Set<number>();
                  if (shift) {
                    for (
                      let i = Math.min(anchor, index);
                      i <= Math.max(anchor, index);
                      i++
                    ) {
                      next.add(i);
                    }
                  } else next.add(index);
                  return next;
                });
                if (!shift) setAnchor(index);
                setTitle(null);
              }}
            />
          </DialogBox>
        </div>
      </Dialog>
      {replacement && (
        <AlertDialog
          icon="song"
          title="가져온 곡을 저장하지 않았습니다. 버릴까요?"
          onCancel={() => setReplacement(null)}
          actions={[
            {
              label: '저장 안 함',
              primary: true,
              onSelect: () => {
                store.discardImported();
                edit(replacement);
                setReplacement(null);
              },
            },
          ]}
        />
      )}
    </>
  );
}
