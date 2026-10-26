import {rm, stat} from 'node:fs/promises';
import {basename, extname} from 'node:path';
import type {MediaId} from '@shared/schema/ids';
import type {
  MediaDocument,
  MediaEditResult,
  MediaImportProgress,
  MediaImportRequest,
  MediaImportResult,
} from '@shared/schema/mediaEdit';
import type {AnalysisFailureReason} from '@shared/schema/mediaAnalysis';
import {MEDIA_LIMITS, type MediaItem} from '@shared/schema/mediaList';
import type {Logger} from '../log';
import {mediaRefusal, type PlaylistRef} from '../store/mediaEdits';
import type {MediaItemsCommit} from '../store/mediaStore';
import {copyWithProgress, freePath, type CopyOptions} from './copyFile';
import type {Analysis, AnalysisRequest, MediaFacts} from './mediaAnalyser';
import {mediaKindOf, type MediaKind} from './mediaKinds';
import {storedPath} from './storedPath';

/** Refer to originals unless copying is enabled (October 27 user decision). */
export const COPY_IMPORTED_MEDIA = false;

/** Imported videos start with their sound off (the plan's open question 15). */
export const IMPORTED_VIDEO_SOUND = false;

/** The most import jobs that wait or run at once. */
export const MAX_IMPORT_JOBS = MEDIA_LIMITS.importBatch;

const UNSUPPORTED = '지원하지 않는 형식';
const COPY_FAILED = '복사하지 못함';
const NOT_ADDED = '미디어 목록에 넣지 못함';

const CANT_PLAY: Readonly<Record<AnalysisFailureReason, string>> = {
  unsupported: '재생할 수 없는 형식',
  decode: '손상되어 재생할 수 없는 파일',
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
  /** Resolved once per admitted request; {@link COPY_IMPORTED_MEDIA} by default. */
  readonly copyIntoFolder?: boolean | (() => Promise<boolean>);
}

interface ImportJob {
  readonly mediaId: MediaId;
  readonly source: string;
  readonly kind: MediaKind;
  readonly fileName: string;
  readonly playlist: PlaylistRef | null;
  readonly copyIntoFolder: boolean;
  readonly abort: AbortController;
  /** Stops following the backend's signal once the job ends. */
  readonly release: () => void;
  /** Set when the job starts joining the media list; it can't be cancelled after. */
  admitting: boolean;
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

function nameOf(fileName: string): string {
  return fileName.slice(0, fileName.length - extname(fileName).length);
}

function cancelled(job: ImportJob): boolean {
  return job.abort.signal.aborted;
}

/**
 * Imports media files one at a time: each job references its source or copies
 * into the media folder, analyses it, then joins the media list and the chosen
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
    const copyIntoFolder = await this.copyPolicy();
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
          copyIntoFolder,
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

  private async copyPolicy(): Promise<boolean> {
    try {
      const policy = this.options.copyIntoFolder;
      return typeof policy === 'function'
        ? await policy()
        : (policy ?? COPY_IMPORTED_MEDIA);
    } catch (error: unknown) {
      this.options.log.warn(
        'could not read media copy preference; using the default',
        error,
      );
      return COPY_IMPORTED_MEDIA;
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
    copyIntoFolder,
  }: {
    readonly source: string;
    readonly playlist: PlaylistRef | null;
    readonly signal: AbortSignal;
    readonly copyIntoFolder: boolean;
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
      copyIntoFolder,
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
        if (job.copyIntoFolder) {
          this.options.report(progress(job, 'copying', value));
        }
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
      await this.removeCopy(placed);
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
      await this.removeCopy(placed);
      return CANCELLED;
    }
    if (analysis.kind === 'cant-play') {
      await this.removeCopy(placed);
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
    if (added.ok || added.error.reason === 'write-failed') return COMPLETE;
    this.options.log.warn('could not add imported media', added.error);
    await this.removeCopy(placed);
    return {phase: 'failed', message: NOT_ADDED};
  }

  private async removeCopy(placed: PlacedFile) {
    if (!placed.copied) return;
    try {
      await rm(placed.file, {force: true});
    } catch (error: unknown) {
      this.options.log.warn('could not remove an unused media copy', {
        file: placed.file,
        error,
      });
    }
  }

  private async place(
    job: ImportJob,
    folder: string,
    onPercent: (percent: number) => void,
  ): Promise<Placed> {
    if (!job.copyIntoFolder) {
      const {size} = await stat(job.source);
      onPercent(100);
      return {ok: true, file: job.source, size, copied: false};
    }
    const target = await freePath(folder, job.fileName);
    if (target === null) return {ok: false, error: COPY_FAILED};
    const copy = this.options.copy ?? copyWithProgress;
    const copied = await copy({
      from: job.source,
      to: target,
      signal: job.abort.signal,
      onPercent,
    });
    if (!copied.ok) {
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
    return {
      id: job.mediaId,
      name: nameOf(job.fileName),
      kind: job.kind,
      file,
      size,
      ...(job.kind === 'video' ? {props: {audio: IMPORTED_VIDEO_SOUND}} : {}),
    };
  }
}
