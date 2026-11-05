import type {LlpApi} from '@contracts/ipc/api';
import type {VerseInput} from '@core/bible/split/splitVerses';
import {entryFor, saveCuts} from '@core/bible/split/splitCache';

/** Merges against a fresh revision so other windows' confirmations survive. */
export async function confirmBibleCuts(
  api: LlpApi['settings'],
  verse: VerseInput,
  cuts: readonly number[],
): Promise<void> {
  const entry = entryFor(verse.text, cuts, new Date().toISOString());
  for (let attempt = 0; attempt < 3; attempt++) {
    const document = await api.get({name: 'bibleCuts'});
    if (document.name !== 'bibleCuts' || document.access !== 'editable') {
      throw new Error('절 나누기 저장 불가');
    }
    const value = saveCuts(document.value, verse.reference, entry);
    if (value === null) throw new Error('저장 가능한 구절 수를 넘었습니다');
    const result = await api.edit({
      type: 'settings.update',
      name: 'bibleCuts',
      baseRevision: document.revision,
      value,
    });
    if (result.ok) return;
    if (result.error.reason !== 'stale') throw new Error('절 나누기 저장 실패');
  }
  throw new Error('다른 창에서 절 나누기가 변경됨');
}
