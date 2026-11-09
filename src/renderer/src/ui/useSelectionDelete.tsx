import {useState} from 'react';
import {AlertDialog} from './AlertDialog';
import {useMenuHandoff} from './useMenuHandoff';
import {noticeTime, type Notice} from './notices';

interface PendingDelete {
  readonly count: number;
  readonly valid: () => boolean;
  readonly remove: () => void;
}

/** Captures one deletion and refuses it if its document changed while asking. */
export function useSelectionDelete(report: (notice: Notice) => void) {
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const stale = (): void =>
    report({
      key: 'selection-delete:stale',
      kind: 'info',
      icon: 'warning',
      title: '항목이 변경되어 삭제하지 않았습니다',
      time: noticeTime(),
    });
  const complete = useMenuHandoff<PendingDelete>(pending !== null, target => {
    if (target.valid()) target.remove();
    else stale();
  });
  return {
    ask: (count: number, valid: () => boolean, remove: () => void): void => {
      if (count === 1) remove();
      else if (count > 1) setPending({count, valid, remove});
    },
    dialog:
      pending === null ? null : (
        <AlertDialog
          icon="trash"
          title={`${pending.count}개를 삭제할까요?`}
          onCancel={() => setPending(null)}
          actions={[
            {
              label: '삭제',
              primary: true,
              onSelect: () => {
                complete(pending);
                setPending(null);
              },
            },
          ]}
        />
      ),
  };
}
