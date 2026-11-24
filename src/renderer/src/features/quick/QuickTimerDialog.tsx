import {useState, type JSX} from 'react';
import {createQuickItemId, createTimerId} from '@core/schema/common/ids';
import {CountdownDialog} from '../tools/timers/CountdownDialog';
import type {QuickEdit} from './quickEdits';

export function QuickTimerDialog({
  locked,
  save,
  onClose,
}: {
  readonly locked: boolean;
  readonly save: (edit: QuickEdit) => Promise<boolean>;
  readonly onClose: () => void;
}): JSX.Element {
  const [ids] = useState(() => ({
    quickItemId: createQuickItemId(crypto.randomUUID()),
    timerId: createTimerId(crypto.randomUUID()),
  }));
  return (
    <CountdownDialog
      locked={locked}
      onClose={onClose}
      onSave={fields => save({kind: 'timer-add', ...ids, ...fields})}
    />
  );
}
