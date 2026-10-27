import type {JSX} from 'react';
import {passageItem} from '@renderer/prep/service/quickAddBible';
import {NEWER_FILE_REASON} from '@renderer/prep/service/ItemArrangement';
import {useShow} from '@renderer/state/show';
import {Button} from '@renderer/ui/Button';
import type {Notice} from '@renderer/ui/notices';
import {useServiceOrderEditing} from '../useServiceOrderEditing';
import {rememberBiblePassage} from './recentWriter';
import type {BibleSource} from './source';

function logProblem(notice: Notice): void {
  console.error('Could not insert the Bible passage', notice.key);
}

/** Adds the previewed passage using the section selected before Bible entry. */
export function BibleInsertButton({
  source,
  onProblem = logProblem,
}: {
  readonly source: BibleSource;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const editing = useServiceOrderEditing(serviceId, onProblem);
  const api = window.llp;
  const reason =
    serviceId === null
      ? '열린 예배 순서 없음'
      : readOnly
        ? NEWER_FILE_REASON
        : api === undefined
          ? '항목 추가 불가'
          : undefined;
  const insert = (): void => {
    if (api === undefined || reason !== undefined) return;
    const view = useShow.getState();
    const selected =
      source.insertion?.serviceId === serviceId
        ? source.insertion.itemId
        : view.openItemId;
    editing.run(async (edits, id) => {
      const result = await edits.insertItemInSection(id, selected, async () => {
        const preferences = await api.preferences.get();
        return passageItem(source.passage.ref, {
          translation: source.passage.translation,
          verseNumbers: preferences.bible.verseNumbers,
        });
      });
      if (result.ok ? result.value : result.error.reason === 'write-failed') {
        rememberBiblePassage(source.passage);
      }
      return result;
    });
  };
  return (
    <Button
      icon="listplus"
      disabled={reason !== undefined || editing.busy}
      title={reason ?? (editing.busy ? '추가 중' : undefined)}
      onClick={insert}
    >
      예배 순서에 넣기
    </Button>
  );
}
