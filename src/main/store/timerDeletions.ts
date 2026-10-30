import type {Result} from '@core/common/result';
import type {EditFailure, EditSuccess} from '@core/schema/contentEdit';
import {isKnownQuickItem} from '@core/schema/quick';
import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/settingsDocuments';
import type {TimerDelete} from '@core/schema/timerDeletion';

interface PreparedDeletion {
  readonly documents: readonly SettingsDocument[];
  readonly applied: EditSuccess;
}

const refuse = (
  reason: 'not-found' | 'read-only' | 'invalid',
  message: string,
): Result<PreparedDeletion, EditFailure> => ({
  ok: false,
  error: {reason, message},
});

export function prepareTimerDeletion(
  documents: ReadonlyMap<SettingsName, SettingsDocument>,
  edit: TimerDelete,
): Result<PreparedDeletion, EditFailure> {
  const timers = documents.get('timers');
  const quick = documents.get('quick');
  if (timers?.name !== 'timers' || quick?.name !== 'quick') {
    return refuse('not-found', 'Timer settings are unavailable');
  }
  if (timers.access !== 'editable') {
    return refuse('read-only', 'Timer settings cannot be edited');
  }
  if (!timers.value.timers.some(timer => timer.id === edit.timerId)) {
    return refuse('not-found', 'The timer is missing');
  }
  const items = quick.value.items.filter(
    row =>
      !(
        isKnownQuickItem(row) &&
        row.kind === 'timer' &&
        row.ref === edit.timerId
      ),
  );
  const quickChanged = items.length !== quick.value.items.length;
  if (quickChanged && quick.access !== 'editable') {
    return refuse('read-only', 'Linked quick timers cannot be removed');
  }
  const nextTimers = parseSettingsDocument({
    ...timers,
    revision: timers.revision + 1,
    value: {
      ...timers.value,
      timers: timers.value.timers.filter(timer => timer.id !== edit.timerId),
    },
  });
  if (!nextTimers.ok) return refuse('invalid', 'Invalid timer deletion');
  const next = [nextTimers.value];
  if (quickChanged) {
    const nextQuick = parseSettingsDocument({
      ...quick,
      revision: quick.revision + 1,
      value: {...quick.value, items},
    });
    if (!nextQuick.ok) {
      return refuse('invalid', 'Invalid linked quick timer deletion');
    }
    next.push(nextQuick.value);
  }
  return {
    ok: true,
    value: {
      documents: next,
      applied: {id: edit.timerId, revision: timers.revision + 1},
    },
  };
}
