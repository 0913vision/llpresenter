import {join} from 'node:path';
import {isJsonObject, type JsonObject} from '../json.mts';
import {readJsonObject, writeJsonObject} from './files.mts';

const MANIFEST = 'package.json';
const LOCKFILE = 'package-lock.json';

/**
 * Reads `version` from `package.json` in `root`.
 *
 * @throws Error when the file has no version string
 */
export async function readPackageVersion(root: string): Promise<string> {
  const {version} = await readJsonObject(join(root, MANIFEST));
  if (typeof version !== 'string') {
    throw new Error(`${MANIFEST} has no version`);
  }
  return version;
}

function withLockVersion(lock: JsonObject, version: string): JsonObject {
  const packages = lock['packages'];
  const rootPackage = isJsonObject(packages) ? packages[''] : undefined;
  if (!isJsonObject(packages) || !isJsonObject(rootPackage)) {
    return {...lock, version};
  }
  return {
    ...lock,
    version,
    packages: {...packages, '': {...rootPackage, version}},
  };
}

/**
 * Sets the version in `package.json` and `package-lock.json` (the lockfile
 * keeps it twice) and leaves every other field as it was.
 */
export async function writePackageVersion(
  root: string,
  version: string,
): Promise<void> {
  const manifestPath = join(root, MANIFEST);
  const manifest = await readJsonObject(manifestPath);
  await writeJsonObject(manifestPath, {...manifest, version});
  const lockPath = join(root, LOCKFILE);
  const lock = await readJsonObject(lockPath);
  await writeJsonObject(lockPath, withLockVersion(lock, version));
}

/** The files that a version bump changes, relative to the root. */
export const VERSION_FILES = [MANIFEST, LOCKFILE] as const;
