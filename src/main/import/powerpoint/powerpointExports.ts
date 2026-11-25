import {constants as fsConstants, existsSync} from 'node:fs';
import {copyFile, rm, stat} from 'node:fs/promises';
import {basename, extname, join} from 'node:path';
import {
  POWERPOINT_PICTURE_LIMITS,
  type PowerPointBackgroundsResult,
  type PowerPointImageExportProgress,
  type PowerPointImageExportResult,
} from '@core/schema/songs/powerpointImport';
import type {Logger} from '../../base/log';
import {
  convertLegacyPowerPoint,
  isLegacyPowerPoint,
  POWERPOINT_BUSY,
  PowerPointError,
  powerPointMessage,
  unsupportedSlideSize,
} from './powerpointFile';
import type {PowerPointImagesJob} from './powerpointImages';
import type {PowerPointJobs} from '../pptx/powerpointJob';
import type {ReadDeck} from './powerpointReader';
import {PowerPointExportScope} from './powerpointExportScope';
import type {PowerPointTurns} from './powerpointTurns';
import {
  readBoundedPicture,
  type TemporaryPictures,
} from '../slidePictures/temporaryPictures';

/** The window that waits for pictures. */
export interface ExportListener {
  readonly isClosed: () => boolean;
  readonly report: (progress: PowerPointImageExportProgress) => void;
}

/**
 * What the PowerPoint slide export uses from outside: the file chooser, the
 * archive jobs, the slide image jobs, the turn queue, the temporary pictures,
 * and the log.
 */
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
/** Why PowerPoint could not draw: it is not installed, or it does not answer. */
type PowerPointFailure = 'unavailable' | 'unresponsive';

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
    const {choose, log} = this.options;
    if (this.disposed) return BUSY;
    await using scope = await PowerPointExportScope.take(this.options);
    if (scope === null) return BUSY;
    this.cancelled = false;
    try {
      const path = await choose();
      if (path === null) return NOTHING;
      return await this.drawSlides(path, await scope.folder(), listener);
    } catch (error) {
      if (this.isStopped()) return NOTHING;
      log.warn('could not export PowerPoint images', error);
      return {ok: false, message: powerPointMessage(error, UNREADABLE)};
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
    const {pictures, log} = this.options;
    if (this.disposed) return null;
    await using scope = await PowerPointExportScope.take(this.options);
    const deck = deckOf();
    if (
      scope === null ||
      deck === null ||
      indices.some(index => deck.source.slides[index] === undefined)
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
    let failure: PowerPointFailure | undefined;
    try {
      const folder = await scope.folder();
      const plain = await this.copyPictures(deck, folder, indices);
      for (const [index, path] of plain) onPicture(index, path);
      if (!isStopped()) {
        const rest = indices.filter(index => !files.has(index));
        const drawn = await this.drawBackgrounds(deck, folder, {
          indices: rest,
          onPicture,
        });
        scope.closeAfter(drawn.closed);
        failure = drawn.failure;
      }
      if (isStopped()) return null;
      if (files.size === 0) {
        return failure === undefined ? null : {failure};
      }
      return [...files].map(([index, path]) => ({index, path}));
    } catch (error) {
      log.warn('could not export PowerPoint backgrounds', error);
      return null;
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
  ): Promise<{
    readonly closed: Promise<void>;
    readonly failure: PowerPointFailure | undefined;
  }> {
    const {images, log} = this.options;
    if (indices.length === 0) {
      return {closed: Promise.resolve(), failure: undefined};
    }
    const copy = join(folder, `presentation${extname(deck.path)}`);
    await copyFile(deck.path, copy, fsConstants.COPYFILE_EXCL);
    const decorationSlides = indices.map(
      index => deck.source.slides[index]?.number ?? 0,
    );
    let closed = Promise.resolve();
    let failure: PowerPointFailure | undefined;
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
          if (result === 'unavailable' || result === 'unresponsive') {
            failure = result;
          }
          log.warn(`PowerPoint background export: ${result}`);
        });
      closed.then(resolve, reject);
    });
    return {closed, failure};
  }
}
