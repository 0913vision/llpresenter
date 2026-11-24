import {useState, type JSX} from 'react';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import type {BibleSource} from '@renderer/session/bibleSource';
import {insertItemInSection} from '@renderer/session/serviceOrderEdits';
import {useShow} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import {type Notice, warningNotice} from '@renderer/ui/notices';
import {rememberBiblePassage} from '../../../session/recentWriter';
import {newBibleItem} from './passageItems';

function logProblem(notice: Notice): void {
  console.error('Could not insert the Bible passage', notice.key);
}

/** Adds the passage that is open to the section selected before it opened. */
export function BibleInsertButton({
  source,
  onProblem = logProblem,
}: {
  readonly source: BibleSource;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const [busy, setBusy] = useState(false);
  const reason =
    serviceId === null
      ? '열린 예배 없음'
      : readOnly
        ? NEWER_FILE_REASON
        : undefined;
  const insert = async (): Promise<void> => {
    const view = useShow.getState();
    const selected = view.rows.some(row => row.id === view.openItemId)
      ? view.openItemId
      : source.insertion?.serviceId === serviceId
        ? source.insertion.itemId
        : null;
    const item = await newBibleItem(source.passage, {
      verseNumbers: source.verseNumbers,
      translationName: source.translationName ?? false,
    });
    if (item === null || useShow.getState().serviceId !== serviceId) return;
    const result = await insertItemInSection(item, selected, {
      select: false,
    });
    if (result.ok || result.error.reason === 'write-failed') {
      rememberBiblePassage(source.passage);
      return;
    }
    throw new Error(result.error.message);
  };
  const press = (): void => {
    if (reason !== undefined || busy) return;
    setBusy(true);
    insert()
      .catch((error: unknown) => {
        console.error('Could not add the passage', error);
        onProblem(warningNotice('bible:insert', '예배 변경 실패'));
      })
      .finally(() => setBusy(false));
  };
  return (
    <Button
      icon="listplus"
      disabled={reason !== undefined || busy}
      title={reason ?? (busy ? '추가 중' : undefined)}
      onClick={press}
    >
      예배 순서에 넣기
    </Button>
  );
}
