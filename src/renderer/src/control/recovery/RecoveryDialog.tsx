import {useState, type JSX} from 'react';
import type {RecoveryRowKind, RecoverySummary} from '@core/schema/recovery';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {CheckRow} from '@renderer/ui/Checkbox';
import {recoveryRows, recoveryTime} from './recoveryView';

const NOTHING_CHECKED_TIP = '복구할 상태를 고르지 않았습니다';

/**
 * The 출력 상태 복구 dialog (spec 08): the rows main offers, all checked at
 * first. Enter is 복구 and Esc is 새로 시작; with no row checked, 복구 is
 * unavailable. Both buttons wait while an answer is on its way.
 */
export function RecoveryDialog({
  summary,
  busy,
  onRestore,
  onStartFresh,
}: {
  readonly summary: NonNullable<RecoverySummary>;
  readonly busy: boolean;
  readonly onRestore: (rows: readonly RecoveryRowKind[]) => void;
  readonly onStartFresh: () => void;
}): JSX.Element {
  const rows = recoveryRows(summary);
  const [unchecked, setUnchecked] = useState<ReadonlySet<RecoveryRowKind>>(
    () => new Set(),
  );
  const checked = rows
    .map(row => row.kind)
    .filter(kind => !unchecked.has(kind));
  const toggle = (kind: RecoveryRowKind, on: boolean): void => {
    setUnchecked(current => {
      const next = new Set(current);
      if (on) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };
  return (
    <AlertDialog
      icon="history"
      title="출력 상태 복구"
      meta={['비정상 종료', recoveryTime(summary.savedAt)]}
      actions={[
        {
          label: '새로 시작',
          escape: true,
          disabled: busy,
          onSelect: onStartFresh,
        },
        {
          label: '복구',
          primary: true,
          disabled: busy || checked.length === 0,
          title: checked.length === 0 ? NOTHING_CHECKED_TIP : undefined,
          onSelect: () => onRestore(checked),
        },
      ]}
      list={{
        label: '복구할 상태',
        children: rows.map(row => (
          <CheckRow
            key={row.kind}
            icon={row.icon}
            label={row.label}
            value={row.value}
            checked={!unchecked.has(row.kind)}
            disabled={busy}
            onChange={on => toggle(row.kind, on)}
          />
        )),
      }}
    />
  );
}
