import type {LlpApi} from '@contracts/ipc/api';
import type {VerseInput} from '@core/bible/split/splitVerses';
import {entryFor, knownCutsFor, saveCuts} from '@core/bible/split/splitCache';

const defaultWrites = new WeakMap<LlpApi['settings'], Promise<void>>();

/** Merges against a fresh revision so other windows' confirmations survive. */
export async function confirmBibleCuts(
  api: LlpApi['settings'],
  verse: VerseInput,
  cuts: readonly number[],
): Promise<void> {
  return saveConfirmedCuts(api, verse, {cuts, onlyIfMissing: false});
}

export async function confirmDefaultBibleCuts(
  api: LlpApi['settings'],
  verse: VerseInput,
  cuts: readonly number[],
): Promise<void> {
  const previous = defaultWrites.get(api) ?? Promise.resolve();
  const write = previous.then(() =>
    saveConfirmedCuts(api, verse, {cuts, onlyIfMissing: true}),
  );
  const settled = write.catch(() => undefined);
  defaultWrites.set(api, settled);
  settled.then(
    () => {
      if (defaultWrites.get(api) === settled) defaultWrites.delete(api);
    },
    () => undefined,
  );
  return write;
}

async function saveConfirmedCuts(
  api: LlpApi['settings'],
  verse: VerseInput,
  options: {readonly cuts: readonly number[]; readonly onlyIfMissing: boolean},
): Promise<void> {
  const {cuts} = options;
  const entry = entryFor(verse.text, cuts, new Date().toISOString());
  for (let attempt = 0; attempt < 3; attempt++) {
    const document = await api.get({name: 'bibleCuts'});
    if (document.name !== 'bibleCuts' || document.access !== 'editable') {
      throw new Error('절 나누기 저장 실패');
    }
    if (
      options.onlyIfMissing &&
      knownCutsFor(document.value, verse.reference, verse.text) !== undefined
    ) {
      return;
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
