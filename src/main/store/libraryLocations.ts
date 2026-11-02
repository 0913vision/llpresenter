import {mkdir, rm, writeFile} from 'node:fs/promises';
import {isAbsolute, join} from 'node:path';
import type {
  BackUpNowResult,
  ChooseLocationResult,
  LibraryLocationField,
  LocationsView,
} from '@core/schema/libraryLocations';
import type {Preferences} from '@core/schema/preferences';
import type {Logger} from '../log';
import {backupGate, Backups, lastBackupTime, type BackupGate} from './backup';
import {isInside, resolveLocations, type DataLocations} from './locations';
import type {LocationContext, LocationFields} from './locations';

const WRITE_TEST_PREFIX = '.llp-write-test-';

/** The `app.json` part the 위치 rows read and write. */
export interface LocationsConfig {
  readonly libraryLocations: LocationFields;
  readonly isReadOnly: boolean;
  setLibraryLocation(field: LibraryLocationField, folder: string): void;
}

export interface LibraryLocationsOptions {
  readonly config: LocationsConfig;
  /** The folders in use since launch; a change of 곡 or 미디어 waits for the next one. */
  readonly inUse: DataLocations;
  readonly context: () => LocationContext;
  readonly backupPreferences: () => Promise<Preferences['backup']>;
  readonly isAnyOutputOn: () => boolean;
  /** Called with the new view after every change of what `view` reads. */
  readonly onChange: (view: LocationsView) => void;
  readonly log: Logger;
  readonly now?: () => Date;
  /** Shared with the launch backup; the app's own gate by default. */
  readonly gate?: BackupGate;
}

/** Picks a folder in the system dialog, or answers null on cancel. */
export type FolderChooser = (current: string) => Promise<string | null>;

/**
 * The folders of the 라이브러리 page of 환경설정: shows them, stores a new one in
 * `app.json` after checking it can be written, and runs 지금 백업. Existing
 * files never move.
 */
export class LibraryLocations {
  private readonly gate: BackupGate;

  constructor(private readonly options: LibraryLocationsOptions) {
    this.gate = options.gate ?? backupGate;
  }

  /**
   * Publishes the folders again whenever a backup starts or ends, also one the
   * launch backup runs.
   *
   * @returns A function that stops it.
   */
  watchBackups(): () => void {
    return this.gate.subscribe(() => {
      this.publish().catch((error: unknown) =>
        this.options.log.warn('could not publish the folders', error),
      );
    });
  }

  async view(): Promise<LocationsView> {
    const {inUse} = this.options;
    const now = this.resolved();
    const lastBackup = await lastBackupTime(now.backups);
    if (!lastBackup.ok) {
      this.options.log.warn('could not read the last backup', lastBackup.error);
    }
    const time = lastBackup.ok ? lastBackup.value : null;
    return {
      songs: {path: now.songs, pending: now.songs !== inUse.songs},
      media: {path: now.media, pending: now.media !== inUse.media},
      backup: {path: now.backups, pending: false},
      lastBackup: time === null ? null : time.getTime(),
      backingUp: this.gate.running,
    };
  }

  async choose(
    field: LibraryLocationField,
    chooser: FolderChooser,
  ): Promise<ChooseLocationResult> {
    const {config, context} = this.options;
    if (config.isReadOnly) {
      return {ok: false, error: {reason: 'settings-locked'}};
    }
    const folder = await chooser(this.currentFolder(field));
    if (folder === null) return {ok: false, error: {reason: 'canceled'}};
    const {developmentFolder} = context();
    if (
      !isAbsolute(folder) ||
      (developmentFolder !== null && !isInside(folder, developmentFolder))
    ) {
      return {ok: false, error: {reason: 'outside-development'}};
    }
    if (this.overlapsBackup(field, folder)) {
      return {ok: false, error: {reason: 'overlaps-backup'}};
    }
    const problem = await writeProblem(folder);
    if (problem !== null) {
      return {ok: false, error: {reason: 'not-writable', detail: problem}};
    }
    config.setLibraryLocation(field, folder);
    await this.publish();
    return {ok: true, value: undefined};
  }

  async backUpNow(): Promise<BackUpNowResult> {
    const {options} = this;
    const preferences = await options.backupPreferences();
    const backups = new Backups({
      locations: {...options.inUse, backups: this.resolved().backups},
      developmentFolder: options.context().developmentFolder,
      preferences: () => preferences,
      isAnyOutputOn: options.isAnyOutputOn,
      gate: this.gate,
      ...(options.now === undefined ? {} : {now: options.now}),
    });
    const outcome = await backups.backUpNow();
    switch (outcome.kind) {
      case 'done':
        for (const problem of outcome.backup.problems) {
          options.log.warn('could not delete an old backup', problem);
        }
        return {ok: true, value: undefined};
      case 'skipped':
        return {
          ok: false,
          error: {
            reason: outcome.reason === 'output-on' ? 'output-on' : 'running',
          },
        };
      case 'failed':
        options.log.warn('the backup failed', outcome.problem);
        return {ok: false, error: {reason: 'failed'}};
    }
  }

  private resolved(): DataLocations {
    const {config, context, inUse} = this.options;
    const fields = {
      dataRoot: inUse.dataRoot,
      ...config.libraryLocations,
    };
    return resolveLocations(fields, context()).locations;
  }

  /**
   * Whether the folder and the 백업 위치 would hold each other, so a backup
   * copied itself. The 백업 위치 is checked against every data folder; 곡 and
   * 미디어 against the 백업 위치.
   */
  private overlapsBackup(field: LibraryLocationField, folder: string): boolean {
    const now = this.resolved();
    const holds = (outer: string, inner: string): boolean =>
      isInside(inner, outer) || isInside(outer, inner);
    if (field === 'backupPath') {
      return [
        now.dataRoot,
        now.songs,
        now.media,
        now.services,
        now.templates,
        now.settings,
      ].some(data => holds(folder, data));
    }
    return holds(now.backups, folder);
  }

  private currentFolder(field: LibraryLocationField): string {
    const now = this.resolved();
    return field === 'songsPath'
      ? now.songs
      : field === 'mediaPath'
        ? now.media
        : now.backups;
  }

  private async publish(): Promise<void> {
    try {
      this.options.onChange(await this.view());
    } catch (error: unknown) {
      this.options.log.warn('could not publish the folders', error);
    }
  }
}

/** Why a folder can't be written, in the system's words, or `null`. */
async function writeProblem(folder: string): Promise<string | null> {
  const probe = join(folder, `${WRITE_TEST_PREFIX}${crypto.randomUUID()}.tmp`);
  try {
    await mkdir(folder, {recursive: true});
    await writeFile(probe, '');
    return null;
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await rm(probe, {force: true}).catch(() => undefined);
  }
}
