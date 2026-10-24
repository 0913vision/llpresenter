import {
  parseAppConfig,
  serializeAppConfig,
  type AppConfig,
} from '@shared/schema/appConfig';
import type {FileError} from '@shared/schema/fileFormat';
import type {ServiceId} from '@shared/schema/ids';
import type {Logger} from '../log';
import {writeFileAtomically} from './atomicWrite';
import {Autosave} from './autosave';
import {FileWriter, type WriteFile} from './fileWriter';
import {readLocationFields, type LocationFields} from './locations';
import {readTextFile} from './readFiles';

const BROKEN_WARNING =
  'app.json is broken, so the app keeps it as it is and never writes over it';
const NEWER_WARNING =
  'app.json comes from a newer app version, so the app never writes over it';

/** The fields of `app.json` that the UI state store owns. */
export type UiFields = Pick<
  AppConfig,
  'layout' | 'previewBig' | 'macroView' | 'macroCollection' | 'mediaStrip'
>;

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

  /** Whether the file couldn't be read or failed its check. */
  get isBroken(): boolean {
    return this.opened.problem !== null;
  }

  read(): UiFields {
    const {layout, previewBig, macroView, macroCollection, mediaStrip} =
      this.config;
    return {
      ...(layout === undefined ? {} : {layout}),
      ...(previewBig === undefined ? {} : {previewBig}),
      ...(macroView === undefined ? {} : {macroView}),
      ...(macroCollection === undefined ? {} : {macroCollection}),
      ...(mediaStrip === undefined ? {} : {mediaStrip}),
    };
  }

  change(fields: UiFields): void {
    this.config = {...this.config, ...fields};
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
  }

  /** Drops a change that waits without saving; call `flush` first to keep it. */
  dispose(): void {
    this.autosave.dispose();
  }

  private scheduleSave(): void {
    if (this.isBroken || this.opened.newer) {
      return;
    }
    this.autosave.schedule(this.options.file, () => this.save());
  }

  private async save(): Promise<void> {
    const {file, log} = this.options;
    const text = serializeAppConfig(this.config, file);
    if (!text.ok) {
      log.error('could not save app.json', text.error);
      return;
    }
    const written = await this.writer.write(file, text.value);
    if (!written.ok) {
      log.warn('could not save app.json', written.error);
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
  const {fields} = readLocationFields(text.value, file);
  const parsed = parseAppConfig(text.value, file);
  if (!parsed.ok) {
    return {
      config: empty,
      locationFields: fields,
      problem: parsed.error,
      newer: false,
    };
  }
  return {
    config: parsed.value.data,
    locationFields: fields,
    problem: null,
    newer: parsed.value.access === 'readOnly',
  };
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
