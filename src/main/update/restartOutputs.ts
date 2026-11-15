import {readFile, rm, stat} from 'node:fs/promises';
import {join} from 'node:path';
import {parseUpdateRestart} from '@core/schema/update';
import type {LiveState} from '@core/live/state';
import type {SettingsReader} from '@core/schema/settingsReader';
import {dispatchBatched} from '../live/store';
import type {Logger} from '../log';
import {switchableScreens} from '../outputs/savedScreens';
import {writeFileAtomically} from '../store/atomicWrite';
import {isMissingFile} from '../store/fsErrors';

const FILE = 'update-restart.json';
const MAX_BYTES = 4096;

/** Persists the screens active when a confirmed update begins shutdown. */
export async function saveRestartOutputs({
  folder,
  version,
  state,
  log,
}: {
  readonly folder: string;
  readonly version: string;
  readonly state: LiveState;
  readonly log: Logger;
}): Promise<boolean> {
  const screens = Object.entries(state.outputs)
    .filter(([, on]) => on)
    .map(([id]) => id);
  const parsed = parseUpdateRestart({version, screens});
  if (!parsed.ok) {
    log.warn('Could not save update restart screens', parsed.error);
    return false;
  }
  const result = await writeFileAtomically(
    join(folder, FILE),
    JSON.stringify(parsed.value),
  );
  if (!result.ok) {
    log.warn('Could not save update restart screens', result.error);
  }
  return result.ok;
}

/** Removes an abandoned restart request. */
export async function cancelRestartOutputs(folder: string): Promise<void> {
  await rm(join(folder, FILE), {force: true});
}

/** Restores a completed update's screens once, or returns false for a normal launch. */
export async function restoreRestartOutputs({
  folder,
  crashed,
  version,
  settings,
  store,
  log,
}: {
  readonly folder: string;
  readonly crashed: boolean;
  readonly version: string;
  readonly settings: Promise<SettingsReader | null>;
  readonly store: Parameters<typeof dispatchBatched>[0];
  readonly log: Logger;
}): Promise<boolean> {
  const file = join(folder, FILE);
  try {
    const info = await stat(file);
    if (crashed || !info.isFile() || info.size > MAX_BYTES) {
      await cancelRestartOutputs(folder);
      return false;
    }
    const input: unknown = JSON.parse(await readFile(file, 'utf8'));
    const parsed = parseUpdateRestart(input);
    if (!parsed.ok) {
      log.warn('Invalid update restart screens', parsed.error);
      await cancelRestartOutputs(folder);
      return false;
    }
    if (parsed.value.version !== version) {
      await cancelRestartOutputs(folder);
      return false;
    }
    const reader = await settings;
    if (reader === null) throw new Error('Screen settings unavailable');
    await cancelRestartOutputs(folder);
    const on = new Set(parsed.value.screens);
    dispatchBatched(
      store,
      switchableScreens(reader).map(({id}) => ({
        type: 'output.set' as const,
        screenId: id,
        on: on.has(id),
      })),
      log,
    );
    return true;
  } catch (error) {
    if (!isMissingFile(error)) {
      log.warn('Could not restore update restart screens', error);
    }
    return false;
  }
}
