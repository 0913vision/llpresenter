import {realpath, rm, stat} from 'node:fs/promises';
import {basename, extname, join, relative} from 'node:path';
import type {MediaId} from '@core/schema/ids';
import type {
  MediaDocument,
  MediaEditResult,
  MediaImportProgress,
  MediaImportRequest,
  MediaImportResult,
} from '@core/schema/mediaEdit';
import type {AnalysisFailureReason} from '@core/schema/mediaAnalysis';
import {importedProps, type MediaDefaults} from '@core/media/importedProps';
import {MEDIA_LIMITS, type MediaItem} from '@core/schema/mediaList';
import {defaultPreferences} from '@core/schema/preferences';
import type {Logger} from '../log';
import {mediaRefusal, type PlaylistRef} from '../store/mediaEdits';
import type {MediaItemsCommit} from '../store/mediaStore';
import {copyWithProgress, freePath, type CopyOptions} from './copyFile';
import type {Analysis, AnalysisRequest, MediaFacts} from './mediaAnalyser';
import {mediaKindOf, type MediaKind} from './mediaKinds';
import {realPathInside} from '../windows/insideRoots';
import {storedPath} from './storedPath';
import {
  beginMediaImport,
  finishMediaImport,
  importTemporary,
} from '../store/mediaImportJournal';

/** The most import jobs that wait or run at once. */
export const MAX_IMPORT_JOBS = MEDIA_LIMITS.importBatch;

const UNSUPPORTED = '지원하지 않는 형식';
const COPY_FAILED = '복사 실패';
const NOT_ADDED = '목록 저장 실패';

const CANT_PLAY: Readonly<Record<AnalysisFailureReason, string>> = {
  unsupported: '재생할 수 없는 형식',
  decode: '손상된 파일',
  network: '읽을 수 없는 파일',
  aborted: '읽을 수 없는 파일',
};

/** What the importer uses of the media store. */
export interface ImportStore {
  get(): MediaDocument;
  readonly folder: string;
  add(
    commit: MediaItemsCommit,
    playlist: PlaylistRef | null,
  ): Promise<MediaEditResult>;
}

/** The arguments of the {@link MediaImporter} constructor. */
export interface MediaImporterOptions {
  readonly store: () => Promise<ImportStore | null>;
  readonly report: (progress: MediaImportProgress) => void;
  /** The import dialog; no files when it is cancelled or unavailable. */
  readonly chooseFiles: () => Promise<readonly string[]>;
  readonly createId: () => MediaId;
  /** Reads a placed file's duration, size, and thumbnail, and whether it can play. */
  readonly analyse: (request: AnalysisRequest) => Promise<Analysis>;
  /** Keeps the thumbnail of a file that joined the media list. */
  readonly saveThumbnail: (
    mediaId: MediaId,
    jpeg: Uint8Array,
    file: string,
  ) => Promise<void>;
  readonly log: Logger;
  readonly copy?: (options: CopyOptions) => ReturnType<typeof copyWithProgress>;
  /** The 새 미디어 defaults, read once per admitted request like the copy choice. */
  readonly defaults?: () => Promise<MediaDefaults>;
}

interface ImportJob {
  readonly mediaId: MediaId;
  readonly source: string;
  readonly kind: MediaKind;
  readonly fileName: string;
  readonly playlist: PlaylistRef | null;
  readonly defaults: MediaDefaults;
  readonly abort: AbortController;
  /** Stops following the backend's signal once the job ends. */
  readonly release: () => void;
  /** Set when the job starts joining the media list; it can't be cancelled after. */
  admitting: boolean;
  journalFolder?: string;
  keepJournal?: boolean;
}

type JobOutcome =
  | {readonly phase: 'complete' | 'cancelled'}
  | {readonly phase: 'failed'; readonly message: string};

const COMPLETE: JobOutcome = {phase: 'complete'};
const CANCELLED: JobOutcome = {phase: 'cancelled'};

type Placed =
  | {
      readonly ok: true;
      readonly file: string;
      readonly size: number;
      readonly copied: boolean;
    }
  | {readonly ok: false; readonly error: string};

type PlacedFile = Extract<Placed, {readonly ok: true}>;

function progress(
  job: Pick<ImportJob, 'mediaId' | 'fileName'>,
  phase: 'queued' | 'copying' | 'analysing' | 'complete' | 'cancelled',
  percent: number,
): MediaImportProgress {
  const base = {mediaId: job.mediaId, fileName: job.fileName};
  switch (phase) {
    case 'queued':
      return {...base, phase, percent: 0};
    case 'complete':
      return {...base, phase, percent: 100};
    case 'copying':
    case 'analysing':
    case 'cancelled':
      return {...base, phase, percent};
  }
}

function factsOf({duration, width, height}: MediaFacts) {
  return {
    ...(duration === undefined ? {} : {duration}),
    ...(width === undefined || height === undefined ? {} : {width, height}),
  };
}

function failed(
  job: Pick<ImportJob, 'mediaId' | 'fileName'>,
  percent: number,
  message: string,
): MediaImportProgress {
  return {
    mediaId: job.mediaId,
    fileName: job.fileName,
    phase: 'failed',
    percent,
    message,
  };
}

/** The list name of an imported file: its name without the extension, cut to the name limit. */
export function nameOf(fileName: string): string {
  const name = fileName
    .slice(0, fileName.length - extname(fileName).length)
    .normalize('NFC');
  let kept = '';
  for (const letter of name) {
    if (kept.length + letter.length > MEDIA_LIMITS.name) break;
    kept += letter;
  }
  return kept;
}

function cancelled(job: ImportJob): boolean {
  return job.abort.signal.aborted;
}

/**
 * Imports media files one at a time: each job copies its source into the media
 * folder (a file already there stays), analyses it, then joins the media list and the chosen
 * playlist with its duration and size. A file Chromium's decoders refuse
 * fails, and its copy is removed. A job can be cancelled while it waits,
 * copies, or is analysed, and disposal cancels all.
 */
export class MediaImporter {
  private readonly jobs = new Map<MediaId, ImportJob>();
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(private readonly options: MediaImporterOptions) {}

  async import(
    request: MediaImportRequest,
    signal: AbortSignal,
  ): Promise<MediaImportResult> {
    const paths =
      request.source.kind === 'dialog'
        ? await this.options.chooseFiles()
        : request.source.paths;
    if (this.isClosing(signal)) {
      return mediaRefusal('not-found', 'Media import is closing');
    }
    if (paths.length === 0) return {ok: true, value: []};
    const defaults = await this.defaultsPolicy();
    if (this.isClosing(signal)) {
      return mediaRefusal('not-found', 'Media import is closing');
    }
    if (this.jobs.size + paths.length > MAX_IMPORT_JOBS) {
      return mediaRefusal('invalid', 'Too many media imports at once');
    }
    return {
      ok: true,
      value: paths.map(path =>
        this.enqueue({
          source: path,
          playlist: request.playlist,
          signal,
          defaults,
        }),
      ),
    };
  }

  cancel(mediaId: MediaId): Promise<MediaEditResult> {
    const job = this.jobs.get(mediaId);
    if (job === undefined) {
      return Promise.resolve(
        mediaRefusal('not-found', 'This import already ended'),
      );
    }
    if (job.admitting) {
      return Promise.resolve(
        mediaRefusal('invalid', 'This import is joining the media list'),
      );
    }
    job.abort.abort();
    return Promise.resolve({ok: true, value: null});
  }

  private isClosing(signal: AbortSignal): boolean {
    return this.disposed || signal.aborted;
  }

  private async defaultsPolicy(): Promise<MediaDefaults> {
    try {
      return (
        (await this.options.defaults?.()) ?? defaultPreferences.media.defaults
      );
    } catch (error: unknown) {
      this.options.log.warn(
        'could not read the new media defaults; using the defaults',
        error,
      );
      return defaultPreferences.media.defaults;
    }
  }

  /** Cancels every job and resolves once the running one has stopped. */
  dispose(): Promise<void> {
    this.disposed = true;
    for (const job of this.jobs.values()) job.abort.abort();
    return this.queue;
  }

  private enqueue({
    source,
    playlist,
    signal,
    defaults,
  }: {
    readonly source: string;
    readonly playlist: PlaylistRef | null;
    readonly signal: AbortSignal;
    readonly defaults: MediaDefaults;
  }): MediaImportProgress {
    const fileName = basename(source);
    const mediaId = this.options.createId();
    const kind = mediaKindOf(source);
    if (kind === null) return failed({mediaId, fileName}, 0, UNSUPPORTED);
    const abort = new AbortController();
    const stop = (): void => {
      abort.abort();
    };
    signal.addEventListener('abort', stop, {once: true});
    const job: ImportJob = {
      mediaId,
      source,
      kind,
      fileName,
      playlist,
      defaults,
      abort,
      release: () => {
        signal.removeEventListener('abort', stop);
      },
      admitting: false,
    };
    this.jobs.set(mediaId, job);
    this.queue = this.queue.then(() => this.run(job));
    return progress(job, 'queued', 0);
  }

  private async run(job: ImportJob): Promise<void> {
    let percent = 0;
    try {
      const outcome = await this.importFile(job, value => {
        percent = value;
        this.options.report(progress(job, 'copying', value));
      });
      this.options.report(
        outcome.phase === 'failed'
          ? failed(job, percent, outcome.message)
          : progress(job, outcome.phase, percent),
      );
    } catch (error: unknown) {
      this.options.log.error('media import failed', {
        file: job.source,
        error,
      });
      this.options.report(failed(job, percent, COPY_FAILED));
    } finally {
      job.release();
      this.jobs.delete(job.mediaId);
    }
  }

  private async importFile(
    job: ImportJob,
    onPercent: (percent: number) => void,
  ): Promise<JobOutcome> {
    if (cancelled(job)) return CANCELLED;
    const store = await this.options.store();
    if (store === null) return {phase: 'failed', message: NOT_ADDED};
    const placed = await this.place(job, store.folder, onPercent);
    if (!placed.ok) {
      return cancelled(job)
        ? CANCELLED
        : {phase: 'failed', message: placed.error};
    }
    if (cancelled(job)) {
      await this.removeCopy(placed, job);
      return CANCELLED;
    }
    this.options.report(progress(job, 'analysing', 100));
    const analysis = await this.options.analyse({
      file: placed.file,
      kind: job.kind,
      thumbnail: true,
      signal: job.abort.signal,
    });
    if (cancelled(job)) {
      await this.removeCopy(placed, job);
      return CANCELLED;
    }
    if (analysis.kind === 'cant-play') {
      await this.removeCopy(placed, job);
      return this.refused(job, analysis);
    }
    if (analysis.kind === 'unavailable') {
      this.options.log.warn('imported media was not analysed', {
        file: job.source,
        message: analysis.message,
      });
    }
    const facts = analysis.kind === 'read' ? analysis.facts : {};
    const outcome = await this.admit(job, store, {placed, facts});
    if (outcome === COMPLETE && !job.keepJournal) {
      // NOTE(0913vision): A failed registry write keeps the intent for launch reconciliation.
      await this.retireJournal(job);
    }
    if (outcome === COMPLETE && facts.thumbnail !== undefined) {
      await this.options.saveThumbnail(
        job.mediaId,
        facts.thumbnail,
        placed.file,
      );
    }
    return outcome;
  }

  private refused(
    job: ImportJob,
    {reason, message}: Extract<Analysis, {readonly kind: 'cant-play'}>,
  ): JobOutcome {
    this.options.log.info('imported media can not play', {
      file: job.source,
      reason,
      message,
    });
    return {phase: 'failed', message: CANT_PLAY[reason]};
  }

  // NOTE(0913vision): The commit boundary. From here the item may already be
  // in the list (the store applies before it saves), so cancelling is
  // refused, and a save that failed keeps the file for the list's retry.
  private async admit(
    job: ImportJob,
    store: ImportStore,
    {placed, facts}: {readonly placed: PlacedFile; readonly facts: MediaFacts},
  ): Promise<JobOutcome> {
    job.admitting = true;
    const added = await store.add(
      {
        items: [
          {
            ...this.itemOf(job, {
              file: storedPath(store.folder, placed.file),
              size: placed.size,
            }),
            ...factsOf(facts),
          },
        ],
        baseRevision: store.get().revision,
      },
      job.playlist,
    );
    if (added.ok) return COMPLETE;
    if (added.error.reason === 'write-failed') {
      job.keepJournal = true;
      return COMPLETE;
    }
    this.options.log.warn('could not add imported media', added.error);
    await this.removeCopy(placed, job);
    return {phase: 'failed', message: NOT_ADDED};
  }

  private async removeCopy(placed: PlacedFile, job: ImportJob) {
    if (!placed.copied) return;
    try {
      await rm(placed.file, {force: true});
      await this.retireJournal(job);
    } catch (error: unknown) {
      this.options.log.warn('could not remove an unused media copy', {
        file: placed.file,
        error,
      });
    }
  }

  private async retireJournal(job: ImportJob): Promise<void> {
    if (job.journalFolder === undefined) return;
    try {
      await finishMediaImport(job.journalFolder, job.mediaId);
    } catch (error: unknown) {
      this.options.log.warn('could not retire the media import journal', error);
    }
  }

  private async place(
    job: ImportJob,
    folder: string,
    onPercent: (percent: number) => void,
  ): Promise<Placed> {
    // NOTE(0913vision): A file already in the media folder stays where it is.
    // It is stored by the path it has inside the folder, not by the path it was
    // chosen through, so a junction or link outside the folder can go away.
    const inside = await realPathInside(job.source, [folder]);
    if (inside !== null) {
      const root = await realpath(folder);
      const file = join(folder, relative(root, inside));
      const {size} = await stat(file);
      return {ok: true, file, size, copied: false};
    }
    const target = await freePath(folder, job.fileName);
    if (target === null) return {ok: false, error: COPY_FAILED};
    const journal = {
      version: 1,
      mediaId: job.mediaId,
      file: basename(target),
    } as const;
    await beginMediaImport(folder, journal);
    job.journalFolder = folder;
    const copy = this.options.copy ?? copyWithProgress;
    const copied = await copy({
      from: job.source,
      to: target,
      signal: job.abort.signal,
      onPercent,
      temporary: importTemporary(folder, journal),
    });
    if (!copied.ok) {
      await this.retireJournal(job);
      if (!cancelled(job)) {
        this.options.log.warn('could not copy imported media', {
          file: job.source,
          error: copied.error,
        });
      }
      return {ok: false, error: COPY_FAILED};
    }
    return {ok: true, file: target, size: copied.value, copied: true};
  }

  private itemOf(
    job: ImportJob,
    {file, size}: {readonly file: string; readonly size: number},
  ): MediaItem {
    const props = importedProps(job.kind, job.defaults);
    return {
      id: job.mediaId,
      name: nameOf(job.fileName),
      kind: job.kind,
      file,
      size,
      ...(props === undefined ? {} : {props}),
    };
  }
}
