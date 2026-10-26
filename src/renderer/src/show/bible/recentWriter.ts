import type {LlpApi} from '@shared/ipc';
import {rememberPassage} from '@shared/bibleRecents';
import type {RecentPassage} from '@shared/schema/bible';

const SAVE_ATTEMPTS = 2;

/** Serializes accepted output history, retaining at most ten pending passages. */
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
        for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
          const document = await api.get({name: 'bible'});
          if (document.name !== 'bible')
            throw new Error('Bible settings are unavailable');
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
          if (result.ok) break;
          if (
            result.error.reason !== 'stale' ||
            attempt === SAVE_ATTEMPTS - 1
          ) {
            throw new Error(result.error.message);
          }
        }
      } catch (error: unknown) {
        console.error('Could not save recent Bible passages', error);
      }
    }
    writing = false;
  };
  return passage => {
    pending = rememberPassage(pending, passage);
    if (!writing) void write();
  };
}
