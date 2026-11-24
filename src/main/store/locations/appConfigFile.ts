import {serializeAppConfig, type AppConfig} from '@core/schema/appConfig';
import type {FileError} from '@core/schema/fileFormat';
import type {ServiceId} from '@core/schema/ids';
import {UI_ZOOM} from '@core/schema/uiZoom';
import type {LaunchTimes} from '@core/schema/launch';
import type {LibraryLocationField} from '@core/schema/libraryLocations';
import type {PreferencePageId} from '@core/schema/preferencePages';
import type {Logger} from '../../base/log';
import {writeFileAtomically} from '../../base/atomicWrite';
import {Autosave} from '../files/autosave';
import {FileWriter, type WriteFile} from '../files/fileWriter';
import {readLocationFields, type LocationFields} from './locations';
import {readTextFile} from '../files/readFiles';

const BROKEN_WARNING =
  'app.json is broken, so the app keeps it as it is and never writes over it';
const NEWER_WARNING =
  'app.json comes from a newer app version, so the app never writes over it';

/** The fields of `app.json` that the UI state store owns. */
export type UiFields = Pick<
  AppConfig,
  | 'layout'
  | 'previewBig'
  | 'previewBigVisible'
  | 'macroView'
  | 'showToolTab'
  | 'slideColumns'
  | 'mediaStrip'
  | 'mediaBrowser'
  | 'mediaImportFolder'
  | 'mediaRelinkFolder'
  | 'textImportFolder'
  | 'powerpointImportFolder'
> & {readonly macroCollection?: AppConfig['macroCollection'] | undefined};

/** The part of `app.json` that the UI state store reads and changes. */
export interface UiStateFields {
  /** The UI fields now, or none of them when `app.json` couldn't be read. */
  read(): UiFields;
  /**
   * Sets the given UI fields and saves the file within half a second, unless
   * the file must stay as it is; then the change lives in memory only.
   */
  change(fields: UiFields): void;
}

export interface AppConfigOptions {
  readonly file: string;
  readonly log: Logger;
  /** Writes the text. An atomic write by default. */
  readonly writeText?: WriteFile<string>;
  readonly writeDelayMs?: number;
}

interface OpenedConfig {
  readonly config: AppConfig;
  readonly locationFields: LocationFields;
  /** Why the file couldn't be read or failed its check, or `null`. */
  readonly problem: FileError | null;
  /** A newer app version wrote the file. */
  readonly newer: boolean;
}

/**
 * Opens `app.json`: the one module that reads, checks, and writes it, so the
 * UI state and the data store never overwrite each other's fields. A broken
 * file, or one from a newer app version, logs one warning that names the
 * file and the field, and is never written; its location fields that are
 * text still count. Never throws.
 */
export async function openAppConfig(
  options: AppConfigOptions,
): Promise<AppConfigFile> {
  const opened = await readConfig(options.file);
  logOpenProblem(opened, options);
  return new AppConfigFile(options, opened);
}

/** `app.json` in memory, saved in order after each change. */
export class AppConfigFile implements UiStateFields {
  private config: AppConfig;
  private readonly writer: FileWriter<string>;
  private readonly autosave: Autosave;
  private dirty = false;

  constructor(
    private readonly options: AppConfigOptions,
    private readonly opened: OpenedConfig,
  ) {
    this.config = opened.config;
    this.writer = new FileWriter(options.writeText ?? writeFileAtomically);
    this.autosave = new Autosave(
      (_key, error) => options.log.error('could not save app.json', error),
      options.writeDelayMs,
    );
  }

  get file(): string {
    return this.options.file;
  }

  /** The data folder fields, even from a broken file when they are text. */
  get locationFields(): LocationFields {
    return this.opened.locationFields;
  }

  get lastServiceId(): string | undefined {
    return this.config.lastServiceId;
  }

  get uiZoomPercent(): number {
    return this.config.uiZoomPercent ?? UI_ZOOM.defaultPercent;
  }

  setUiZoomPercent(percent: number): void {
    this.config = {...this.config, uiZoomPercent: percent};
    this.scheduleSave();
  }

  get launchTimes(): LaunchTimes {
    return this.config.launchTimes ?? {};
  }

  setLaunchTimes(launchTimes: LaunchTimes): void {
    this.config = {...this.config, launchTimes};
    this.scheduleSave();
  }

  get screensWindow(): AppConfig['screensWindow'] {
    return this.config.screensWindow;
  }

  setScreensWindow(placement: NonNullable<AppConfig['screensWindow']>): void {
    this.config = {...this.config, screensWindow: placement};
    this.scheduleSave();
  }

  get preferencesWindow(): AppConfig['preferencesWindow'] {
    return this.config.preferencesWindow;
  }

  setPreferencesWindow(
    placement: NonNullable<AppConfig['preferencesWindow']>,
  ): void {
    this.config = {...this.config, preferencesWindow: placement};
    this.scheduleSave();
  }

  get preferencesPage(): AppConfig['preferencesPage'] {
    return this.config.preferencesPage;
  }

  setPreferencesPage(page: PreferencePageId): void {
    this.config = {...this.config, preferencesPage: page};
    this.scheduleSave();
  }

  /** The folders 환경설정 stored for 곡, 미디어, and 백업; empty is the default. */
  get libraryLocations(): LocationFields {
    const {songsPath, mediaPath, backupPath} = this.config;
    return {
      ...(songsPath === undefined ? {} : {songsPath}),
      ...(mediaPath === undefined ? {} : {mediaPath}),
      ...(backupPath === undefined ? {} : {backupPath}),
    };
  }

  setLibraryLocation(field: LibraryLocationField, folder: string): void {
    this.config = {...this.config, [field]: folder};
    this.scheduleSave();
  }

  /** Whether a change would be dropped: the file is broken or from a newer app. */
  get isReadOnly(): boolean {
    return this.isBroken || this.opened.newer;
  }

  /** Whether the file couldn't be read or failed its check. */
  get isBroken(): boolean {
    return this.opened.problem !== null;
  }

  read(): UiFields {
    const {
      layout,
      previewBig,
      previewBigVisible,
      macroView,
      macroCollection,
      showToolTab,
      slideColumns,
      mediaStrip,
      mediaBrowser,
      mediaImportFolder,
      mediaRelinkFolder,
      textImportFolder,
      powerpointImportFolder,
    } = this.config;
    return {
      ...(layout === undefined ? {} : {layout}),
      ...(previewBig === undefined ? {} : {previewBig}),
      ...(previewBigVisible === undefined ? {} : {previewBigVisible}),
      ...(macroView === undefined ? {} : {macroView}),
      ...(macroCollection === undefined ? {} : {macroCollection}),
      ...(showToolTab === undefined ? {} : {showToolTab}),
      ...(slideColumns === undefined ? {} : {slideColumns}),
      ...(mediaStrip === undefined ? {} : {mediaStrip}),
      ...(mediaBrowser === undefined ? {} : {mediaBrowser}),
      ...(mediaImportFolder === undefined ? {} : {mediaImportFolder}),
      ...(mediaRelinkFolder === undefined ? {} : {mediaRelinkFolder}),
      ...(textImportFolder === undefined ? {} : {textImportFolder}),
      ...(powerpointImportFolder === undefined ? {} : {powerpointImportFolder}),
    };
  }

  change(fields: UiFields): void {
    const {macroCollection, ...otherFields} = fields;
    const {macroCollection: previousCollection, ...config} = this.config;
    const selected =
      'macroCollection' in fields ? macroCollection : previousCollection;
    this.config = {
      ...config,
      ...otherFields,
      ...(selected === undefined ? {} : {macroCollection: selected}),
    };
    this.scheduleSave();
  }

  /** Remembers the 예배 순서 that 진행 opens at the next launch. */
  setLastServiceId(serviceId: ServiceId): void {
    this.config = {...this.config, lastServiceId: serviceId};
    this.scheduleSave();
  }

  /** Saves a change that waits, and resolves once every save has ended. */
  async flush(): Promise<void> {
    await this.autosave.flush();
    await this.writer.idle();
    if (this.dirty) await this.save();
  }

  /** Retries the latest app.json and reports whether it reached disk. */
  async savePending(): Promise<boolean> {
    await this.flush();
    return !this.dirty;
  }

  /** Drops a change that waits without saving; call `flush` first to keep it. */
  dispose(): void {
    this.autosave.dispose();
  }

  private scheduleSave(): void {
    if (this.isBroken || this.opened.newer) {
      return;
    }
    this.dirty = true;
    this.autosave.schedule(this.options.file, () => this.save());
  }

  private async save(): Promise<void> {
    const {file, log} = this.options;
    const config = this.config;
    const text = serializeAppConfig(config, file);
    if (!text.ok) {
      log.error('could not save app.json', text.error);
      return;
    }
    const written = await this.writer.write(file, text.value);
    if (!written.ok) {
      log.warn('could not save app.json', written.error);
    } else if (this.config === config) {
      this.dirty = false;
    }
  }
}

async function readConfig(file: string): Promise<OpenedConfig> {
  const empty: AppConfig = {format: 'llapp', schemaVersion: 1};
  const text = await readTextFile(file);
  if (!text.ok) {
    return {
      config: empty,
      locationFields: {},
      problem: text.error,
      newer: false,
    };
  }
  if (text.value === null) {
    return {config: empty, locationFields: {}, problem: null, newer: false};
  }
  const {fields, config, newer, problem} = readLocationFields(text.value, file);
  return {config: config ?? empty, locationFields: fields, problem, newer};
}

function logOpenProblem(
  {problem, newer}: OpenedConfig,
  {file, log}: AppConfigOptions,
): void {
  if (problem !== null) {
    log.warn(BROKEN_WARNING, problem);
  } else if (newer) {
    log.warn(NEWER_WARNING, {file});
  }
}
