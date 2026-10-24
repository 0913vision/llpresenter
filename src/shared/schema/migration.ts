import type {UnknownRecord} from '../guards';

const FIRST_VERSION = 1;

/**
 * Converts a file object from schema version N to N + 1. A step keeps every
 * field it doesn't change, unknown fields included. The caller sets
 * `schemaVersion`, so a step never has to.
 */
export type MigrationStep = (file: UnknownRecord) => UnknownRecord;

/** The schema version the app writes: one more than the number of steps. */
export function currentVersion(steps: readonly MigrationStep[]): number {
  return FIRST_VERSION + steps.length;
}

/**
 * Runs the steps from `fromVersion` up to the current version, in order.
 *
 * @param steps - Index 0 converts version 1 to 2, index 1 converts 2 to 3, and
 *   so on.
 * @throws Whatever a step throws. The caller turns it into a result.
 */
export function migrate(
  file: UnknownRecord,
  fromVersion: number,
  steps: readonly MigrationStep[],
): UnknownRecord {
  let migrated = file;
  let version = fromVersion;
  for (const step of steps.slice(fromVersion - FIRST_VERSION)) {
    version += 1;
    migrated = {...step(migrated), schemaVersion: version};
  }
  return migrated;
}
