import {readFile, stat} from 'node:fs/promises';
import {isRecord} from '@core/common/guards';
import {parseFontCatalog, type FontCatalog} from '@core/schema/fontCatalog';
import {writeFileAtomically} from '../store/atomicWrite';
import {isMissingFile} from '../store/fsErrors';

const MAX_CACHE_BYTES = 2 * 1024 * 1024;
const STAMP = /^[a-f0-9]{64}$/;

/** A validated catalog and the font installation it describes. */
export interface SavedFontCatalog {
  readonly stamp: string;
  readonly families: FontCatalog;
}

/** Untrusted disk caches never establish font absence before stamp validation. */
export async function readCatalogFile(
  file: string,
): Promise<SavedFontCatalog | null> {
  try {
    if ((await stat(file)).size > MAX_CACHE_BYTES) {
      throw Error('Font cache is too large');
    }
    const value: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      typeof value.stamp !== 'string' ||
      !STAMP.test(value.stamp)
    ) {
      throw Error('Invalid font cache');
    }
    const parsed = parseFontCatalog(value.families);
    if (!parsed.ok) throw Error('Invalid cached font metadata');
    return {stamp: value.stamp, families: parsed.value};
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

/** Persists only successfully enumerated metadata with a stable installation stamp. */
export async function writeCatalogFile(
  file: string,
  value: SavedFontCatalog,
): Promise<void> {
  const written = await writeFileAtomically(
    file,
    JSON.stringify({version: 1, ...value}),
  );
  if (!written.ok) throw Error(written.error.message);
}
