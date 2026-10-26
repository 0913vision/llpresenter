import {basename} from 'node:path';
import type {FileAccess, LoadedFile} from '@shared/schema/fileFormat';
import {parseMediaDocument, type MediaDocument} from '@shared/schema/mediaEdit';
import {
  parseMediaList,
  serializeMediaList,
  type MediaList,
} from '@shared/schema/mediaList';
import type {Logger} from '../log';
import {EMPTY_MEDIA_LIST} from './defaults';
import {documentFiles} from './documentFiles';
import type {LoadedStore} from './fileStore';
import {RecoveryCopies} from './recoveryCopies';
import {Saver} from './saver';
import {
  readSettingsFile,
  settingsLocation,
  type SettingsLocation,
} from './settingsFile';
import type {SettingsProblem, SettingsReader} from './settingsStore';
import {MediaStore} from './mediaStore';
import type {SaveFailureSink} from './saveFailures';

/** What the media list opens with besides the loaded data. */
export interface MediaStoreContext {
  readonly settings: SettingsReader | null;
  readonly log: Logger;
  /** Hears the files that couldn't be written, for 저장할 수 없음. */
  readonly failures?: SaveFailureSink | undefined;
}

/** Loads the media list independently and creates only a missing file. */
export async function openMediaStore(
  store: LoadedStore,
  {settings, log, failures}: MediaStoreContext,
): Promise<{
  readonly store: MediaStore;
  readonly problems: readonly SettingsProblem[];
}> {
  const location = settingsLocation(store.locations, 'media');
  const copies = new RecoveryCopies({
    folder: store.locations.recovery,
    keep: () =>
      settings?.preferences().backupCopies ?? store.preferences.backupCopies,
  });
  const saver = new Saver({
    copies,
    reportCopyProblem: error =>
      log.warn('could not keep a recovery copy', error),
  });
  const {document, problems} = await readMediaDocument(location, saver);
  const opened = new MediaStore({
    document,
    file: location.file,
    mediaFolder: store.locations.media,
    developmentFolder: store.developmentFolder,
    files: documentFiles({saver, copies, log, failures}),
    log,
  });
  const [pathProblem] = opened.startupProblems;
  if (pathProblem !== undefined) {
    problems.push({
      file: basename(location.file),
      error: {
        ...pathProblem,
        message: `${pathProblem.message} (${opened.startupProblems.length} refused paths)`,
      },
    });
  }
  for (const problem of problems) {
    log.warn('skipped a data file or a part of one', problem.error);
  }
  return {store: opened, problems};
}

async function readMediaDocument(
  location: SettingsLocation,
  saver: Saver,
): Promise<{
  readonly document: MediaDocument;
  readonly problems: SettingsProblem[];
}> {
  const empty = parseMediaDocument({
    name: 'media',
    value: EMPTY_MEDIA_LIST,
    access: 'editable',
    revision: 1,
  });
  if (!empty.ok) throw new Error(empty.error.message);
  let access: FileAccess = 'editable';
  try {
    const read = await readSettingsFile<LoadedFile<MediaList>>(
      location,
      (text, file) => {
        const parsed = parseMediaList(text, file);
        return parsed.ok
          ? {ok: true, value: {...parsed.value, data: parsed.value}}
          : parsed;
      },
    );
    access = read.problems.some(problem => problem.kind === 'newer')
      ? 'readOnly'
      : (read.data?.access ?? 'editable');
    const document = parseMediaDocument({
      name: 'media',
      value: read.data?.data ?? EMPTY_MEDIA_LIST,
      access,
      revision: 1,
    });
    if (!document.ok) {
      throw new Error(`${document.error.field}: ${document.error.message}`);
    }
    const problems = read.problems.map(error => ({
      file: basename(location.file),
      error,
    }));
    if (read.data === null && problems.length === 0) {
      const problem = await createMediaFile(
        document.value,
        location.file,
        saver,
      );
      if (problem !== null) problems.push(problem);
    }
    return {document: document.value, problems};
  } catch (error: unknown) {
    return {
      document: {...empty.value, access},
      problems: [
        {
          file: basename(location.file),
          error: {
            kind: 'invalid',
            file: location.file,
            field: '',
            message: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    };
  }
}

async function createMediaFile(
  document: MediaDocument,
  file: string,
  saver: Saver,
): Promise<SettingsProblem | null> {
  const text = serializeMediaList(document.value, file);
  if (!text.ok) return {file: basename(file), error: text.error};
  const saved = await saver.save({
    target: {file, kind: 'settings', id: 'media'},
    text: text.value,
  });
  if (!saved.ok) throw new Error(saved.error.message);
  return null;
}
