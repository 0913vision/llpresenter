import type {LlpApi} from '@contracts/ipc/api';
import type {MediaId} from '@core/schema/common/ids';
import type {PowerPointSource} from '@core/schema/songs/powerpointImport';
import type {TextImportDraft} from '@core/schema/songs/textImport';
import {importedSongTitle} from '@core/slides';
import {powerpointBrightBackgrounds, powerpointSlides} from '@core/songs';
import {lendPreviewImage} from '@renderer/rendering/media/previewMedia';
import {openInPrep} from '@renderer/session/prepTarget';
import {noticeTime, type Notice} from '@renderer/ui/popups/notices';
import {
  finishImportedPictures,
  openImportedSong,
  replaceImportedPictures,
  requestLeaveSong,
  type ImportPictures,
} from '../songDraft';
import {
  exportPowerPointBackgrounds,
  storePowerPointBackgrounds,
  type PowerPointBackgrounds,
} from './powerPointBackgrounds';

const READING = 'powerpoint:read';
const FAILED = 'PowerPoint 가져오기 실패';

interface Reports {
  readonly report: (notice: Notice) => void;
  readonly dismiss: (key: string) => void;
}

function warn({report}: Reports, title: string, meta?: string): void {
  report({
    key: READING,
    kind: 'warning',
    icon: 'warning',
    title,
    time: noticeTime(),
    ...(meta === undefined ? {} : {meta: [meta]}),
  });
}

/** The title the slides show, or the name of the file. */
function titleOf({fileName, slides}: PowerPointSource): string {
  const slide = powerpointSlides(slides).find(entry => entry.titleSlide);
  const name =
    slide === undefined
      ? ''
      : importedSongTitle({...slide, lines: [...slide.lines]});
  return name === '' ? fileName.replace(/\.[^.]+$/u, '') : name;
}

/** Stands in for a background until it comes, in the color its texts need. */
function plainPicture(bright: boolean): Blob {
  const fill = bright ? 'white' : 'black';
  return new Blob(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="${fill}"/></svg>`,
    ],
    {type: 'image/svg+xml'},
  );
}

/** Fills the backgrounds in while the song is already open in the editor. */
class SongBackgrounds implements ImportPictures {
  private active = true;
  private reading = true;
  private found: PowerPointBackgrounds['found'] = new Map();
  private free = (): void => undefined;
  /** The pictures that stand in for backgrounds that are still to come. */
  private readonly waiting = new Map<string, MediaId>();
  private readonly plain: Array<() => void> = [];
  /** The song the slides become. */
  readonly draft: TextImportDraft;

  constructor(
    private readonly api: LlpApi,
    private readonly source: PowerPointSource,
    private readonly reports: Reports,
  ) {
    const bright = powerpointBrightBackgrounds(source.slides);
    for (const {background} of source.slides) {
      if (this.waiting.has(background)) continue;
      const plain = lendPreviewImage(plainPicture(bright.has(background)));
      if (plain === null) continue;
      this.waiting.set(background, plain.id);
      this.plain.push(plain.release);
    }
    const slides = powerpointSlides(source.slides).map((slide, index) => {
      const key = source.slides[index]?.background ?? '';
      const picture = this.waiting.get(key);
      return {
        ...slide,
        lines: [...slide.lines],
        ...(picture === undefined ? {} : {picture}),
        ...(bright.has(key) ? {light: true as const} : {}),
      };
    });
    this.draft = {title: titleOf(source), preserveSlides: true, slides};
  }

  async fill(): Promise<void> {
    try {
      const {release} = await exportPowerPointBackgrounds(
        this.api,
        this.source.slides,
        {
          active: () => this.active,
          onFound: found => {
            this.found = found;
            for (const [key, {preview}] of found) this.replace(key, preview);
          },
        },
      );
      if (this.active) this.free = release;
      else release();
    } catch (error) {
      console.error('Could not export the PowerPoint backgrounds', error);
    }
    if (!this.active) return;
    const missing = this.waiting.size > 0;
    for (const key of [...this.waiting.keys()]) this.replace(key, null);
    finishImportedPictures(this);
    this.close();
    if (missing) {
      warn(this.reports, '배경을 모두 가져오지 못했습니다.', 'PowerPoint');
    }
  }

  readonly keep: ImportPictures['keep'] = (ids, title) =>
    storePowerPointBackgrounds(
      this.api,
      [...this.found.values()].filter(({preview}) => ids.has(preview)),
      title,
    );

  readonly release = (): void => {
    if (!this.active) return;
    this.active = false;
    this.free();
    for (const release of this.plain) release();
    if (!this.reading) return;
    this.api.powerpoint.cancelImages().catch(() => undefined);
    this.close();
  };

  private replace(key: string, picture: MediaId | null): void {
    const plain = this.waiting.get(key);
    if (plain === undefined) return;
    this.waiting.delete(key);
    replaceImportedPictures(this, new Map([[plain, picture]]));
  }

  /** Frees the file that was read. */
  private close(): void {
    this.reading = false;
    this.api.powerpoint
      .cancelRead()
      .catch((error: unknown) =>
        console.error('PowerPoint source release failed', error),
      );
  }
}

function open(api: LlpApi, source: PowerPointSource, reports: Reports): void {
  const backgrounds = new SongBackgrounds(api, source, reports);
  openImportedSong(backgrounds.draft, backgrounds);
  openInPrep({kind: 'song'});
  backgrounds
    .fill()
    .catch((error: unknown) =>
      console.error('Could not fill the backgrounds in', error),
    );
}

/**
 * Asks for a presentation and opens the song it is in the editor at once. Its
 * backgrounds come in while it is open.
 */
export async function importPowerPointSong(
  api: LlpApi,
  reports: Reports,
): Promise<void> {
  const stop = api.powerpoint.subscribeReading(({fileName}) =>
    reports.report({
      key: READING,
      kind: 'info',
      icon: 'fileppt',
      title: 'PowerPoint 읽는 중',
      meta: [fileName],
      time: noticeTime(),
      persistent: true,
      actions: [
        {
          icon: 'close',
          label: '취소',
          onSelect: () => {
            api.powerpoint.cancelRead().catch(() => undefined);
          },
        },
      ],
    }),
  );
  let result: Awaited<ReturnType<typeof api.powerpoint.read>> | undefined;
  try {
    result = await api.powerpoint.read();
  } catch (error) {
    console.error('Could not read the PowerPoint file', error);
  } finally {
    stop();
  }
  reports.dismiss(READING);
  if (result?.ok !== true) {
    warn(reports, FAILED, result?.message);
    return;
  }
  const source = result.value;
  if (source === null) return;
  requestLeaveSong(
    () => open(api, source, reports),
    () => {
      api.powerpoint.cancelRead().catch(() => undefined);
    },
  );
}
