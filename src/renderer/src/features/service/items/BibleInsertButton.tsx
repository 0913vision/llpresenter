import type {JSX} from 'react';
import {passageItem} from '@renderer/features/service/items/quickAddBible';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useShow} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import type {Notice} from '@renderer/ui/notices';
import {useServiceOrderEditing} from '../order/useServiceOrderEditing';
import {rememberBiblePassage} from '../../../session/recentWriter';
import type {BibleSource} from '@core/bible/source';
import {useBibleDefaults} from './useBibleDefaults';

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
  const defaults = useBibleDefaults();
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
    const selected = view.rows.some(row => row.id === view.openItemId)
      ? view.openItemId
      : source.insertion?.serviceId === serviceId
        ? source.insertion.itemId
        : null;
    editing.run(async (edits, id) => {
      const result = await edits.insertItemInSection(id, selected, () => {
        // NOTE(0913vision): The preview picks the numbering and the reference;
        // loaded 환경설정 defaults give the translation name. New items always
        // start each verse anew. Until loaded, use the built-in defaults.
        return Promise.resolve(
          passageItem(source.passage.ref, {
            ...defaults,
            translation: source.passage.translation,
            verseNumbers: source.verseNumbers,
            reference: source.reference,
          }),
        );
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
