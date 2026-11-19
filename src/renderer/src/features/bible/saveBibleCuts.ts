import type {LlpApi} from '@contracts/ipc/api';
import type {VerseInput} from '@core/bible/split/splitVerses';
import {entryFor, saveCuts} from '@core/bible/split/splitCache';

const confirmations = new WeakMap<LlpApi['settings'], Promise<void>>();

/** Serializes confirmations and merges against the current settings revision. */
export function confirmBibleCuts(
  api: LlpApi['settings'],
  verse: VerseInput,
  cuts: readonly number[],
): Promise<void> {
  const previous = confirmations.get(api) ?? Promise.resolve();
  const write = previous.then(() => saveConfirmedCuts(api, verse, cuts));
  const settled = write.catch(() => undefined);
  confirmations.set(api, settled);
  settled.then(
    () => {
      if (confirmations.get(api) === settled) confirmations.delete(api);
    },
    () => undefined,
  );
  return write;
}

async function saveConfirmedCuts(
  api: LlpApi['settings'],
  verse: VerseInput,
  cuts: readonly number[],
): Promise<void> {
  const entry = entryFor(verse.text, cuts, new Date().toISOString());
  for (let attempt = 0; attempt < 3; attempt++) {
    const document = await api.get({name: 'bibleCuts'});
    if (document.name !== 'bibleCuts' || document.access !== 'editable') {
      throw new Error('절 나누기 저장 실패');
    }
    const value = saveCuts(document.value, verse.reference, entry);
    if (value === null) throw new Error('구절이 너무 많아 저장할 수 없습니다');
    const result = await api.edit({
      type: 'settings.update',
      name: 'bibleCuts',
      baseRevision: document.revision,
      value,
    });
    if (result.ok) return;
    if (result.error.reason !== 'stale') throw new Error('절 나누기 저장 실패');
  }
  throw new Error('다른 창에서 절 나누기를 바꿨습니다');
}
