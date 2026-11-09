import {
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rm,
  rmdir,
} from 'node:fs/promises';
import {basename, join, resolve} from 'node:path';
import {
  parseMediaImportJournal,
  type MediaImportJournal,
} from '@core/schema/mediaImportJournal';
import type {MediaList} from '@core/schema/mediaList';
import type {Logger} from '../log';
import {writeFileAtomically} from './atomicWrite';
import {isMissingFile} from './fsErrors';

const JOURNAL_FOLDER = '.imports';
const MAX_JOURNAL_BYTES = 4096;
const MAX_JOURNALS = 200;

/** The temporary copy named by the durable import intent. */
export function importTemporary(
  folder: string,
  journal: MediaImportJournal,
): string {
  return join(folder, `.${journal.file}.${journal.mediaId}.tmp`);
}

/** Writes ownership before a copy can publish either its temporary or final file. */
export async function beginMediaImport(
  folder: string,
  journal: MediaImportJournal,
): Promise<void> {
  const directory = await journalDirectory(folder);
  if (!parseMediaImportJournal(journal).ok) {
    throw new Error('Invalid import journal');
  }
  if ((await readdir(directory)).length >= MAX_JOURNALS) {
    throw new Error('Too many unfinished media imports');
  }
  const written = await writeFileAtomically(
    join(directory, `${journal.mediaId}.json`),
    JSON.stringify(journal),
  );
  if (!written.ok) throw new Error(written.error.message);
}

/** Retires an intent only after registry commit or successful copy cleanup. */
export async function finishMediaImport(
  folder: string,
  mediaId: string,
): Promise<void> {
  const directory = await journalDirectory(folder);
  await rm(join(directory, `${mediaId}.json`), {force: true});
  try {
    await rmdir(directory);
  } catch (error: unknown) {
    if (
      !(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOTEMPTY'
      ) &&
      !isMissingFile(error)
    ) {
      throw error;
    }
  }
}

async function journalDirectory(
  folder: string,
  create = true,
): Promise<string> {
  const directory = join(folder, JOURNAL_FOLDER);
  if (create) await mkdir(directory, {recursive: true});
  if ((await lstat(directory)).isSymbolicLink()) {
    throw new Error('Import journal must not be a link');
  }
  return directory;
}

function pathKey(file: string): string {
  const absolute = resolve(file);
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
}

async function registeredPaths(
  folder: string,
  media: MediaList,
): Promise<Set<string>> {
  const paths = new Set<string>();
  for (const item of media.items) {
    const file = resolve(folder, item.file);
    paths.add(pathKey(file));
    try {
      paths.add(pathKey(await realpath(file)));
    } catch (error: unknown) {
      if (!isMissingFile(error)) throw error;
    }
  }
  return paths;
}

async function readJournal(file: string): Promise<MediaImportJournal> {
  if ((await lstat(file)).size > MAX_JOURNAL_BYTES) {
    throw new Error('Import journal is too large');
  }
  const parsed = parseMediaImportJournal(
    JSON.parse(await readFile(file, 'utf8')),
  );
  if (!parsed.ok || basename(file) !== `${parsed.value.mediaId}.json`) {
    throw new Error('Invalid import journal');
  }
  return parsed.value;
}

async function removeUnregistered(
  target: string,
  protectedPaths: Set<string>,
): Promise<void> {
  if (protectedPaths.has(pathKey(target))) return;
  try {
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error('Import copy is not a regular file');
    }
    if (!protectedPaths.has(pathKey(await realpath(target)))) await rm(target);
  } catch (error: unknown) {
    if (!isMissingFile(error)) throw error;
  }
}

async function recoverOne(
  file: string,
  folder: string,
  {protectedPaths, log}: {protectedPaths: Set<string>; log: Logger},
): Promise<void> {
  try {
    const journal = await readJournal(file);
    await removeUnregistered(join(folder, journal.file), protectedPaths);
    await removeUnregistered(importTemporary(folder, journal), protectedPaths);
    await rm(file);
  } catch (error: unknown) {
    log.warn('could not recover an interrupted media import', {
      file: basename(file),
      error,
    });
  }
}

/** Cleans journal-owned leftovers before imports start; registered files always win. */
export async function recoverMediaImports(
  folder: string,
  media: MediaList,
  log: Logger,
): Promise<void> {
  try {
    const directory = await journalDirectory(folder, false);
    const protectedPaths = await registeredPaths(folder, media);
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      await recoverOne(join(directory, entry.name), folder, {
        protectedPaths,
        log,
      });
    }
  } catch (error: unknown) {
    if (!isMissingFile(error)) {
      log.warn('could not read the media import journal', error);
    }
  }
}
