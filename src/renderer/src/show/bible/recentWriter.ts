import type {LlpApi} from '@contracts/ipc/api';
import {rememberPassage} from '@core/bible/bibleRecents';
import type {RecentPassage} from '@core/schema/bible';

const SAVE_ATTEMPTS = 2;
let owner: LlpApi['settings'] | undefined;
let remember: ((passage: RecentPassage) => void) | undefined;

/** Records a passage after successful output or service insertion. */
export function rememberBiblePassage(passage: RecentPassage): void {
  const settings = window.llp?.settings;
  if (settings === undefined) return;
  if (owner !== settings) {
    owner = settings;
    remember = recentWriter(settings);
  }
  remember?.(passage);
}

/** Serializes successful passage history, retaining at most ten pending entries. */
export function recentWriter(
  api: LlpApi['settings'],
): (passage: RecentPassage) => void {
  let pending: readonly RecentPassage[] = [];
  let writing = false;
  const write = async (): Promise<void> => {
    writing = true;
    while (pending.length > 0) {
      const batch = pending;
      pending = [];
      try {
        await saveBatch(api, batch);
      } catch (error: unknown) {
        console.error('Could not save recent Bible passages', error);
      }
    }
    writing = false;
  };
  return passage => {
    pending = rememberPassage(pending, passage);
    if (!writing) {
      write().catch((error: unknown) => {
        writing = false;
        console.error('Could not finish recent Bible writes', error);
      });
    }
  };
}

async function saveBatch(
  api: LlpApi['settings'],
  batch: readonly RecentPassage[],
): Promise<void> {
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
    const document = await api.get({name: 'bible'});
    if (document.name !== 'bible') {
      throw new Error('Bible settings are unavailable');
    }
    const recents = batch.reduceRight(
      (history, passage) => rememberPassage(history, passage),
      document.value.recents,
    );
    const result = await api.edit({
      type: 'settings.update',
      name: 'bible',
      baseRevision: document.revision,
      value: {...document.value, recents},
    });
    if (result.ok) return;
    if (result.error.reason !== 'stale' || attempt === SAVE_ATTEMPTS - 1) {
      throw new Error(result.error.message);
    }
  }
}
