import {rm} from 'node:fs/promises';
import {basename} from 'node:path';
import {
  parsePowerPointReadResult,
  type PowerPointReadResult,
  type PowerPointSource,
} from '@core/schema/powerpointImport';
import type {Logger} from '../base/log';
import {
  convertLegacyPowerPoint,
  isLegacyPowerPoint,
  powerPointMessage,
  unsupportedSlideSize,
} from './powerpointFile';
import type {PowerPointImagesJob} from './powerpointImages';
import type {PowerPointJobs} from './powerpointJob';
import type {PowerPointTurns} from './powerpointTurns';
import {removeFolder, temporaryFolder} from './temporaryPictures';

/** A file that was read, whose backgrounds can still be asked for. */
export interface ReadDeck {
  readonly path: string;
  readonly digest: string;
  readonly source: PowerPointSource;
  /** The picture in the file that all of a slide's background is. */
  readonly pictures: ReadonlyArray<string | undefined>;
}

export interface PowerPointReaderOptions {
  /** Asks for a file; `null` when the operator chose none. */
  readonly choose: () => Promise<string | null>;
  readonly jobs: Pick<PowerPointJobs, 'run'> &
    Partial<Pick<PowerPointJobs, 'cancel'>>;
  readonly converter: Pick<PowerPointImagesJob, 'run' | 'cancel'>;
  readonly turns: PowerPointTurns;
  readonly log: Logger;
}

const BUSY: PowerPointReadResult = {
  ok: false,
  message: 'PowerPoint 파일을 읽는 중입니다.',
};
const NOTHING: PowerPointReadResult = {ok: true, value: null};
const UNREADABLE =
  'PowerPoint 파일이 손상되었거나 암호화되었거나 크기 제한을 넘었습니다.';
const DIGEST = /^[a-f0-9]{64}$/;

function picturesOf(slides: unknown): ReadonlyArray<string | undefined> {
  return (Array.isArray(slides) ? slides : []).map((slide: unknown) =>
    typeof slide === 'object' &&
    slide !== null &&
    'picture' in slide &&
    typeof slide.picture === 'string'
      ? slide.picture
      : undefined,
  );
}

/** Checks what the worker read of the file at `path`. */
function deckOf(
  result: unknown,
  {path, fileName}: {readonly path: string; readonly fileName: string},
): ReadDeck {
  if (
    typeof result === 'object' &&
    result !== null &&
    'digest' in result &&
    typeof result.digest === 'string' &&
    DIGEST.test(result.digest) &&
    'slides' in result
  ) {
    const parsed = parsePowerPointReadResult({
      ok: true,
      value: {
        fileName,
        slides: result.slides,
        widescreen: 'widescreen' in result ? result.widescreen : undefined,
      },
    });
    if (parsed.ok && parsed.value.ok && parsed.value.value !== null) {
      return {
        path,
        digest: result.digest,
        source: parsed.value.value,
        pictures: picturesOf(result.slides),
      };
    }
  }
  throw new Error('Invalid PowerPoint worker result');
}

/** Reads the texts of a PowerPoint file, and keeps the file it read last. */
export class PowerPointReader {
  private deck: ReadDeck | null = null;
  /** The folder of the converted copy that `deck` is. */
  private folder: string | null = null;
  private cancelled = false;
  private disposed = false;

  constructor(private readonly options: PowerPointReaderOptions) {}

  /** The file that was read last. */
  get current(): ReadDeck | null {
    return this.deck;
  }

  /**
   * Reads a file that the operator chooses.
   *
   * @param onFile - Told the name of the file once it is chosen.
   */
  async read(
    onFile: (fileName: string) => void,
  ): Promise<PowerPointReadResult> {
    const {choose, turns, log} = this.options;
    if (!turns.startReading()) return BUSY;
    this.cancelled = false;
    this.forget();
    try {
      const path = await choose();
      if (path === null || this.isStopped()) return NOTHING;
      onFile(basename(path));
      return isLegacyPowerPoint(path)
        ? await this.readConverted(path)
        : await this.readFile(path, basename(path));
    } catch (error) {
      if (this.isStopped()) return NOTHING;
      log.warn('could not read PowerPoint', error);
      return {ok: false, message: powerPointMessage(error, UNREADABLE)};
    } finally {
      turns.endReading();
    }
  }

  /** Stops the read, or forgets what was read; tells if there was any. */
  cancel(): boolean {
    const {jobs, converter, turns} = this.options;
    if (!turns.isReading) return this.forget();
    this.cancelled = true;
    this.forget();
    jobs.cancel?.('read');
    converter.cancel();
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.options.converter.cancel();
    this.forget();
  }

  private readonly isStopped = (): boolean => this.cancelled || this.disposed;

  private async readConverted(path: string): Promise<PowerPointReadResult> {
    const {converter} = this.options;
    const folder = await temporaryFolder();
    try {
      const converted = await convertLegacyPowerPoint(path, {
        folder,
        converter,
        isStopped: this.isStopped,
      });
      if (this.isStopped()) return NOTHING;
      const result = await this.readFile(converted, basename(path));
      if (this.deck !== null) this.folder = folder;
      return result;
    } finally {
      if (this.folder !== folder) {
        await rm(folder, {recursive: true, force: true});
      }
    }
  }

  private async readFile(
    path: string,
    fileName: string,
  ): Promise<PowerPointReadResult> {
    const result = await this.options.jobs.run({kind: 'read', path});
    if (this.isStopped()) return NOTHING;
    const sizeError = unsupportedSlideSize(result);
    if (sizeError !== null) return {ok: false, message: sizeError};
    this.deck = deckOf(result, {path, fileName});
    return {ok: true, value: this.deck.source};
  }

  // NOTE(0913vision): An export may still read the converted copy.
  private forget(): boolean {
    const {turns, log} = this.options;
    const {folder} = this;
    this.deck = null;
    this.folder = null;
    if (folder === null) return false;
    turns.whenNoExport(() => {
      removeFolder(folder, log);
    });
    return true;
  }
}
