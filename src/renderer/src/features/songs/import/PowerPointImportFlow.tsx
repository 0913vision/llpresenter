import {useEffect, useMemo, useRef, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {PowerPointSource} from '@core/schema/powerpointImport';
import type {TextImportDraft} from '@core/schema/textImport';
import {powerpointSlides} from '@core/songs/powerpointSlides';
import {powerpointBackgroundName} from '@core/media/powerpointBackground';
import {Dialog} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui';
import {SlideThumbnail} from '@renderer/ui/SlideThumbnail';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {SongEditorStore} from '../editor/songEditorStore';
import styles from './PowerPointImport.module.css';

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
  {index, title}: {readonly index: number; readonly title: string},
  isActive: () => boolean,
): Promise<TextImportDraft['background']> {
  const previous = backgroundQueue;
  let unlock: () => void = () => undefined;
  backgroundQueue = new Promise<void>(resolve => {
    unlock = resolve;
  });
  try {
    await previous;
    if (!isActive()) return undefined;
    const path = await api.powerpoint.background({index});
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
  useEffect(() => {
    let active = true;
    pending.current ??= api.powerpoint.read();
    pending.current
      .then(result => {
        if (!active) return;
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
        if (active) {
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
  if (!source) return null;
  return (
    <PowerPointDialog
      api={api}
      store={store}
      source={source}
      onDone={onDone}
      onEdit={onEdit}
      onProblem={onProblem}
    />
  );
}

function PowerPointDialog({
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
  const [anchor, setAnchor] = useState(0);
  const [end, setEnd] = useState(source.slides.length - 1);
  const [title, setTitle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replacement, setReplacement] = useState<TextImportDraft | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const start = Math.min(anchor, end);
  const finish = Math.max(anchor, end);
  const range = useMemo(
    () => source.slides.slice(start, finish + 1),
    [source, start, finish],
  );
  const slides = useMemo(() => powerpointSlides(range), [range]);
  const defaultTitle =
    slides.find(slide => 'titleSlide' in slide && slide.titleSlide)?.lines[0] ??
    source.fileName.replace(/\.[^.]+$/, '');
  const shownTitle = title ?? defaultTitle;
  const allSlides = powerpointSlides(source.slides);
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
      const counts = new Map<string, {count: number; index: number}>();
      range.forEach((slide, offset) => {
        if (slide.background) {
          const previous = counts.get(slide.background);
          counts.set(slide.background, {
            count: (previous?.count ?? 0) + 1,
            index: previous?.index ?? start + offset,
          });
        }
      });
      const winner = [...counts.values()].sort((a, b) => b.count - a.count)[0];
      let background: TextImportDraft['background'];
      if (winner) {
        background = await importSelectedBackground(
          api,
          {index: winner.index, title: shownTitle},
          () => active.current,
        );
      }
      if (!active.current) return;
      const draft: TextImportDraft = {
        title: shownTitle,
        slides,
        preserveSlides: true,
        ...(background === undefined ? {} : {background}),
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
          onDone();
        }}
        cancelLabel="저장 안 함"
        primary={{
          label: '편집',
          disabled: busy || slides.length === 0,
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
          </div>
          <div className={styles.grid}>
            {source.slides.map((slide, index) => {
              const shown =
                index >= start && index <= finish
                  ? slides[index - start]
                  : allSlides[index];
              return (
                <div
                  key={slide.number}
                  className={styles.tile}
                  aria-pressed={index >= start && index <= finish}
                  onClick={event => {
                    if (event.shiftKey) setEnd(index);
                    else {
                      setAnchor(index);
                      setEnd(index);
                    }
                    setTitle(null);
                  }}
                >
                  <SlideThumbnail
                    number={slide.number}
                    text={shown?.lines.join('\n')}
                    label={
                      shown && 'titleSlide' in shown
                        ? '제목'
                        : shown?.lines.length === 0
                          ? '빈 슬라이드'
                          : undefined
                    }
                    selected={index >= start && index <= finish}
                  />
                </div>
              );
            })}
          </div>
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
