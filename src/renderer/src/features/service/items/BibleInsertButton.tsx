import type {JSX} from 'react';
import {
  passageItem,
  type PassageDefaults,
} from '@renderer/features/service/items/quickAddBible';
import {NEWER_FILE_REASON} from '@renderer/features/service/items/ItemArrangement';
import {useShow} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import type {Notice} from '@renderer/ui/notices';
import {useServiceOrderEditing} from '../order/useServiceOrderEditing';
import {rememberBiblePassage} from '../../../session/recentWriter';
import type {BibleSource} from '@core/bible/source';

async function readNewPassageDefaults(
  api: NonNullable<typeof window.llp>,
): Promise<Pick<PassageDefaults, 'split' | 'translationName'>> {
  try {
    const {split, translationName} = (await api.preferences.get()).bible
      .defaults;
    return {split, translationName};
  } catch (error) {
    console.error('Could not read the new passage defaults', error);
    return {};
  }
}

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
      ? '열린 예배 없음'
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
        // NOTE(0913vision): The preview picks the numbering and the reference;
        // the 환경설정 defaults give the split and the translation name, as in
        // the 성경 구절… dialog.
        const defaults = await readNewPassageDefaults(api);
        return passageItem(source.passage.ref, {
          ...defaults,
          translation: source.passage.translation,
          verseNumbers: source.verseNumbers,
          reference: source.reference,
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
