import {constants as fsConstants, existsSync} from 'node:fs';
import {copyFile, rm, stat} from 'node:fs/promises';
import {basename, extname, join} from 'node:path';
import {
  POWERPOINT_PICTURE_LIMITS,
  type PowerPointBackgroundsResult,
  type PowerPointImageExportProgress,
  type PowerPointImageExportResult,
} from '@core/schema/powerpointImport';
import type {Logger} from '../base/log';
import {
  convertLegacyPowerPoint,
  isLegacyPowerPoint,
  POWERPOINT_BUSY,
  PowerPointError,
  powerPointMessage,
  unsupportedSlideSize,
} from './powerpointFile';
import type {PowerPointImagesJob} from './powerpointImages';
import type {PowerPointJobs} from './powerpointJob';
import type {ReadDeck} from './powerpointReader';
import type {PowerPointTurns} from './powerpointTurns';
import {readBoundedPicture, type TemporaryPictures} from './temporaryPictures';

/** The window that waits for pictures. */
export interface ExportListener {
  readonly isClosed: () => boolean;
  readonly report: (progress: PowerPointImageExportProgress) => void;
}

export interface PowerPointExportsOptions {
  /** Asks for a file; `null` when the operator chose none. */
  readonly choose: () => Promise<string | null>;
  readonly jobs: Pick<PowerPointJobs, 'run'>;
  readonly images: Pick<PowerPointImagesJob, 'run' | 'cancel'>;
  readonly converter: Pick<PowerPointImagesJob, 'run' | 'cancel'>;
  readonly turns: PowerPointTurns;
  readonly pictures: TemporaryPictures;
  readonly log: Logger;
}

/** Told the place of a slide, and the picture of its background. */
type OnPicture = (index: number, path: string) => void;

const BUSY: PowerPointImageExportResult = {
  ok: false,
  message: POWERPOINT_BUSY,
};
const NOTHING: PowerPointImageExportResult = {ok: true, value: null};
const UNREADABLE = 'PowerPoint 파일을 읽을 수 없습니다.';
const NUMBER_DIGITS = 4;

/** The file that PowerPoint writes its picture number `done` to. */
function exportedPicture(folder: string, done: number): string {
  const number = String(done).padStart(NUMBER_DIGITS, '0');
  return join(folder, `llp-ppt-${number}.png`);
}

/** Has PowerPoint draw slides, or what is behind their texts. */
export class PowerPointExports {
  private cancelled = false;
  private disposed = false;

  constructor(private readonly options: PowerPointExportsOptions) {}

  /** Draws every slide of a file that the operator chooses. */
  async slides(listener: ExportListener): Promise<PowerPointImageExportResult> {
    const {choose, turns, pictures, log} = this.options;
    await turns.lastExport();
    if (this.disposed || !turns.startExport()) return BUSY;
    this.cancelled = false;
    let folder: string | null = null;
    try {
      const path = await choose();
      if (path === null) return NOTHING;
      folder = await pictures.openFolder();
      return await this.drawSlides(path, folder, listener);
    } catch (error) {
      if (this.isStopped()) return NOTHING;
      log.warn('could not export PowerPoint images', error);
      return {ok: false, message: powerPointMessage(error, UNREADABLE)};
    } finally {
      if (folder !== null) await pictures.closeFolder(folder);
      turns.endExport();
    }
  }

  /**
   * Gives the backgrounds of slides of the file that was read, one picture
   * each: the picture in the file where that is all of it, and otherwise what
   * PowerPoint draws without the texts.
   */
  async backgrounds(
    deckOf: () => ReadDeck | null,
    indices: readonly number[],
    listener: ExportListener,
  ): Promise<PowerPointBackgroundsResult> {
    const {turns, pictures, log} = this.options;
    await turns.lastExport();
    const deck = deckOf();
    if (
      deck === null ||
      this.disposed ||
      indices.some(index => deck.source.slides[index] === undefined) ||
      !turns.startExport()
    ) {
      return null;
    }
    this.cancelled = false;
    const isStopped = (): boolean => this.isStopped() || deckOf() !== deck;
    const files = new Map<number, string>();
    const onPicture: OnPicture = (index, path) => {
      if (isStopped() || listener.isClosed() || !existsSync(path)) return;
      pictures.add(path);
      files.set(index, path);
      listener.report({
        done: files.size,
        total: indices.length,
        picture: {index, path},
      });
    };
    let folder: string | null = null;
    let closed = Promise.resolve();
    try {
      folder = await pictures.openFolder();
      const plain = await this.copyPictures(deck, folder, indices);
      for (const [index, path] of plain) onPicture(index, path);
      if (!isStopped()) {
        const rest = indices.filter(index => !files.has(index));
        ({closed} = await this.drawBackgrounds(deck, folder, {
          indices: rest,
          onPicture,
        }));
      }
      return isStopped() || files.size === 0
        ? null
        : [...files].map(([index, path]) => ({index, path}));
    } catch (error) {
      log.warn('could not export PowerPoint backgrounds', error);
      return null;
    } finally {
      turns.endExport(this.whenClosed(closed, folder));
    }
  }

  /** Stops the export that runs, and tells if there was one. */
  cancel(): boolean {
    if (!this.options.turns.isExporting) return false;
    this.cancelled = true;
    this.stopJobs();
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.stopJobs();
  }

  private readonly isStopped = (): boolean => this.cancelled || this.disposed;

  private stopJobs(): void {
    this.options.images.cancel();
    this.options.converter.cancel();
  }

  private async whenClosed(
    closed: Promise<void>,
    folder: string | null,
  ): Promise<void> {
    const {pictures, log} = this.options;
    try {
      await closed;
    } catch (error) {
      log.warn('could not close PowerPoint', error);
    }
    if (folder === null) return;
    try {
      await pictures.closeFolder(folder);
    } catch (error) {
      log.warn('could not remove PowerPoint pictures', error);
    }
  }

  /** Copies a file for PowerPoint, so it never opens or locks the original. */
  private async copyOf(path: string, folder: string): Promise<string> {
    if (isLegacyPowerPoint(path)) {
      const {converter} = this.options;
      return convertLegacyPowerPoint(path, {
        folder,
        converter,
        isStopped: this.isStopped,
      });
    }
    const copy = join(folder, `presentation${extname(path).toLowerCase()}`);
    await copyFile(path, copy, fsConstants.COPYFILE_EXCL);
    return copy;
  }

  private async drawSlides(
    path: string,
    folder: string,
    listener: ExportListener,
  ): Promise<PowerPointImageExportResult> {
    const {jobs, images, pictures} = this.options;
    const copy = await this.copyOf(path, folder);
    if (this.isStopped()) return NOTHING;
    const deck = await jobs.run({kind: 'size', path: copy});
    if (this.isStopped()) return NOTHING;
    const sizeError = unsupportedSlideSize(deck);
    if (sizeError !== null) return {ok: false, message: sizeError};
    const slides: Array<{path: string; number: number}> = [];
    let expected = 0;
    const result = await images.run(copy, folder, (done, total, number) => {
      if (
        done !== slides.length + 1 ||
        total > POWERPOINT_PICTURE_LIMITS.count ||
        done > total ||
        number < 1 ||
        (expected !== 0 && total !== expected)
      ) {
        return;
      }
      expected = total;
      slides.push({path: exportedPicture(folder, done), number});
      listener.report({done, total});
    });
    await rm(copy, {force: true});
    if (result === 'cancelled' || this.isStopped()) return NOTHING;
    if (result !== 'ok') throw new PowerPointError('export', result);
    if (slides.length === 0 || slides.length !== expected) {
      throw new PowerPointError('export', 'file');
    }
    await Promise.all(slides.map(slide => stat(slide.path)));
    for (const slide of slides) pictures.add(slide.path);
    return {ok: true, value: {fileName: basename(path), slides}};
  }

  /** Copies the pictures in the file that all of a background is. */
  private async copyPictures(
    deck: ReadDeck,
    folder: string,
    indices: readonly number[],
  ): Promise<ReadonlyMap<number, string>> {
    const {jobs, log} = this.options;
    const files = new Map<number, string>();
    const wanted = indices.flatMap(index => {
      const part = deck.pictures[index];
      if (part === undefined) return [];
      const extension = extname(part).toLowerCase() || '.png';
      const target = join(folder, `llp-ppt-picture-${index}${extension}`);
      files.set(index, target);
      return [{part, target}];
    });
    if (wanted.length === 0) return files;
    try {
      await jobs.run({
        kind: 'pictures',
        path: deck.path,
        digest: deck.digest,
        pictures: wanted,
      });
    } catch (error) {
      log.warn('could not read PowerPoint pictures', error);
      return new Map();
    }
    for (const [index, path] of files) {
      if ((await readBoundedPicture(path)) === null) files.delete(index);
    }
    return files;
  }

  /**
   * Has PowerPoint draw slides without their texts, one picture each. The
   * pictures are ready before PowerPoint has closed again.
   */
  private async drawBackgrounds(
    deck: ReadDeck,
    folder: string,
    {
      indices,
      onPicture,
    }: {readonly indices: readonly number[]; readonly onPicture: OnPicture},
  ): Promise<{readonly closed: Promise<void>}> {
    const {images, log} = this.options;
    if (indices.length === 0) return {closed: Promise.resolve()};
    const copy = join(folder, `presentation${extname(deck.path)}`);
    await copyFile(deck.path, copy, fsConstants.COPYFILE_EXCL);
    const decorationSlides = indices.map(
      index => deck.source.slides[index]?.number ?? 0,
    );
    let closed = Promise.resolve();
    await new Promise<void>((resolve, reject) => {
      const onDone = (done: number): void => {
        const index = indices[done - 1];
        if (index !== undefined) {
          onPicture(index, exportedPicture(folder, done));
        }
        if (done >= indices.length) resolve();
      };
      closed = images
        .run(copy, folder, Object.assign(onDone, {decorationSlides}))
        .then(result => {
          if (result === 'ok') return;
          log.warn(`PowerPoint background export: ${result}`);
        });
      closed.then(resolve, reject);
    });
    return {closed};
  }
}
