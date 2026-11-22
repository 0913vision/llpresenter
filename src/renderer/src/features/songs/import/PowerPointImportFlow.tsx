import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {PowerPointSource} from '@core/schema/powerpointImport';
import type {TextImportDraft} from '@core/schema/textImport';
import type {MediaId} from '@core/schema/ids';
import {
  powerpointDarkLyrics,
  powerpointSlides,
} from '@core/songs/powerpointSlides';
import {songSlides} from '@core/slides/songSlides';
import {songTiles} from '@core/slides/tiles';
import {slideMaking, useThemes} from '@renderer/platform/themes';
import {openInPrep} from '@renderer/session/prepTarget';
import {Checkbox, Progress, TextField} from '@renderer/ui';
import {Dialog} from '@renderer/ui/Dialog';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {openImportedSong, requestLeaveSong} from '../songDraft';
import {
  exportPowerPointBackgrounds,
  importPowerPointBackgrounds,
  type PowerPointBackgrounds,
} from './powerPointBackgrounds';
import {SlidePreviewGrid} from './SlidePreviewGrid';
import styles from './PowerPointImport.module.css';

const TITLE = 'PowerPoint에서 곡 가져오기';

/** The song a range of slides becomes, with the pictures it is drawn on. */
function draftOf(
  range: PowerPointSource['slides'],
  title: string,
  media: ReadonlyMap<string, MediaId>,
): TextImportDraft {
  return {
    title,
    preserveSlides: true,
    light: powerpointDarkLyrics(range),
    slides: powerpointSlides(range).map((slide, index) => {
      const key = range[index]?.background;
      const picture = key === undefined ? undefined : media.get(key);
      return {
        ...slide,
        lines: [...slide.lines],
        ...(picture === undefined ? {} : {picture}),
      };
    }),
  };
}

/** The title the slides show, or the name of the file. */
function titleOf(range: PowerPointSource['slides'], fileName: string): string {
  const slide = powerpointSlides(range).find(entry => entry.titleSlide);
  const shown = slide?.lines
    .slice(0, slide.titleLineCount ?? 1)
    .map(row => row.trim())
    .filter(row => row !== '')
    .join(' ');
  return shown === undefined || shown === ''
    ? fileName.replace(/\.[^.]+$/u, '')
    : shown;
}

interface Exported {
  readonly backgrounds: PowerPointBackgrounds | null;
  readonly done: number;
  readonly total: number;
}

/** What is behind the slides, exported while the dialog is open. */
function useBackgrounds(api: LlpApi, source: PowerPointSource): Exported {
  const [state, setState] = useState<Exported>({
    backgrounds: null,
    done: 0,
    total: 0,
  });
  useEffect(() => {
    let active = true;
    let release: (() => void) | undefined;
    // NOTE(0913vision): The timer drops the first of the two mounts that
    // React makes in development, which would export everything twice.
    const timer = setTimeout(() => {
      exportPowerPointBackgrounds(api, source.slides, {
        active: () => active,
        progress: (done, total) => {
          if (active) setState(before => ({...before, done, total}));
        },
      }).then(
        backgrounds => {
          if (!active) {
            backgrounds.release();
            return;
          }
          release = backgrounds.release;
          setState(before => ({...before, backgrounds}));
        },
        (error: unknown) => {
          console.error('Could not export the PowerPoint backgrounds', error);
          if (!active) return;
          setState(before => ({
            ...before,
            backgrounds: {found: new Map(), release: () => undefined},
          }));
        },
      );
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
      release?.();
      api.powerpoint.cancelImages().catch(() => undefined);
    };
  }, [api, source]);
  return state;
}

function PowerPointDialog({
  api,
  source,
  onDone,
  onProblem,
}: {
  readonly api: LlpApi;
  readonly source: PowerPointSource;
  readonly onDone: () => void;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const themes = useThemes(view => view.themes);
  const exported = useBackgrounds(api, source);
  const [anchor, setAnchor] = useState(0);
  const [end, setEnd] = useState(source.slides.length - 1);
  const [typed, setTyped] = useState<string | null>(null);
  const [background, setBackground] = useState(true);
  const [busy, setBusy] = useState(false);
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
  const title = typed ?? titleOf(range, source.fileName);
  const found = exported.backgrounds?.found;
  const previews = useMemo(
    () =>
      new Map(
        [...(background ? (found ?? []) : [])].map(
          ([key, {preview}]) => [key, preview] as const,
        ),
      ),
    [found, background],
  );
  const tiles = useMemo(
    () =>
      songTiles({
        title,
        // NOTE(0913vision): The themes are the ones the slides are made with.
        slides:
          themes === null
            ? []
            : songSlides(
                slideMaking(),
                draftOf(source.slides, title, previews),
              ),
      }),
    [themes, source, title, previews],
  );
  const waiting = background && exported.backgrounds === null;
  const create = async (): Promise<void> => {
    setBusy(true);
    try {
      const media = background
        ? await importPowerPointBackgrounds(
            api,
            new Set(range.map(slide => slide.background)),
            {found: found ?? new Map(), title},
          )
        : new Map<string, MediaId>();
      if (!active.current) return;
      const draft = draftOf(range, title, media);
      requestLeaveSong(() => {
        openImportedSong(draft);
        openInPrep({kind: 'song'});
        onDone();
      });
    } catch (error) {
      console.error('Could not import the PowerPoint song', error);
      if (!active.current) return;
      onProblem({
        key: 'powerpoint:edit',
        kind: 'warning',
        icon: 'warning',
        title: 'PowerPoint 가져오기 실패',
        time: noticeTime(),
      });
    } finally {
      if (active.current) setBusy(false);
    }
  };
  return (
    <Dialog
      title={TITLE}
      size="xl"
      subtitle={{icon: 'filetext', text: source.fileName}}
      onCancel={onDone}
      cancelLabel="저장 안 함"
      primary={{
        label: '편집',
        disabled: busy || waiting || title.trim() === '',
        title: waiting ? '배경을 가져오는 중입니다' : undefined,
        onSelect: () => {
          create().catch((error: unknown) =>
            console.error('Could not make the song', error),
          );
        },
      }}
      footerStart={
        waiting ? (
          <Progress
            value={
              exported.total === 0
                ? null
                : (exported.done / exported.total) * 100
            }
            label="배경 가져오는 중"
            valueText={`${exported.done} / ${exported.total}`}
          />
        ) : undefined
      }
    >
      <div className={styles.content}>
        <div className={styles.title}>
          <TextField
            aria-label="제목"
            block
            value={title}
            onChange={setTyped}
          />
          <span>슬라이드 {range.length}</span>
          <label className={styles.option}>
            <Checkbox
              aria-label="배경"
              checked={background}
              onChange={setBackground}
            />
            배경
          </label>
        </div>
        <SlidePreviewGrid
          tiles={tiles}
          numberOf={index => source.slides[index]?.number ?? index + 1}
          isSelected={index => index >= start && index <= finish}
          onSelect={(index, shift) => {
            if (!shift) setAnchor(index);
            setEnd(index);
            setTyped(null);
          }}
        />
      </div>
    </Dialog>
  );
}

/** Reads a presentation and makes a song of some of its slides. */
export function PowerPointImportFlow({
  api,
  onDone,
  onProblem,
}: {
  readonly api: LlpApi;
  readonly onDone: () => void;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const [source, setSource] = useState<PowerPointSource | null>(null);
  const pending = useRef<ReturnType<typeof api.powerpoint.read> | null>(null);
  const cancelled = useRef(false);
  const finish = useCallback(() => {
    cancelled.current = true;
    api.powerpoint
      .cancelRead()
      .catch((error: unknown) =>
        console.error('PowerPoint source release failed:', error),
      );
    onDone();
  }, [api, onDone]);
  useEffect(() => {
    let active = true;
    const failed = (title: string): void => {
      onProblem({
        key: 'powerpoint:read',
        kind: 'warning',
        icon: 'warning',
        title,
        time: noticeTime(),
      });
      onDone();
    };
    pending.current ??= api.powerpoint.read();
    pending.current.then(
      result => {
        if (!active || cancelled.current) return;
        if (!result.ok) failed(result.message);
        else if (result.value === null) onDone();
        else setSource(result.value);
      },
      () => {
        if (active && !cancelled.current) failed('PowerPoint 가져오기 실패');
      },
    );
    return () => {
      active = false;
    };
  }, [api, onDone, onProblem]);
  return source === null ? (
    <Dialog
      title={TITLE}
      size="s"
      onCancel={finish}
      primary={{label: '가져오기', disabled: true, onSelect: () => undefined}}
    >
      <Progress value={null} label="PowerPoint 읽는 중" />
    </Dialog>
  ) : (
    <PowerPointDialog
      api={api}
      source={source}
      onDone={finish}
      onProblem={onProblem}
    />
  );
}
