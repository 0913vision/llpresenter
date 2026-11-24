import {editableTimers, timerRefusal} from './editableTimers';
import type {Result} from '@core/common/result';
import type {EditFailure, EditSuccess} from '@core/schema/services/contentEdit';
import {isKnownQuickItem} from '@core/schema/tools/quick';
import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/app/settingsDocuments';
import type {TimerDelete} from '@core/schema/tools/timerDeletion';

interface PreparedDeletion {
  readonly documents: readonly SettingsDocument[];
  readonly applied: EditSuccess;
}

/**
 * Prepares the deletion of a timer, with the 빠른 타이머 that uses it, or refuses
 * it.
 */
export function prepareTimerDeletion(
  documents: ReadonlyMap<SettingsName, SettingsDocument>,
  edit: TimerDelete,
): Result<PreparedDeletion, EditFailure> {
  const editable = editableTimers(documents);
  if (!editable.ok) return editable;
  const {timers, quick} = editable.value;
  if (!timers.value.timers.some(timer => timer.id === edit.timerId)) {
    return timerRefusal('not-found', 'The timer is missing');
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
    return timerRefusal('read-only', 'Linked quick timers cannot be removed');
  }
  const nextTimers = parseSettingsDocument({
    ...timers,
    revision: timers.revision + 1,
    value: {
      ...timers.value,
      timers: timers.value.timers.filter(timer => timer.id !== edit.timerId),
    },
  });
  if (!nextTimers.ok) return timerRefusal('invalid', 'Invalid timer deletion');
  const next = [nextTimers.value];
  if (quickChanged) {
    const nextQuick = parseSettingsDocument({
      ...quick,
      revision: quick.revision + 1,
      value: {...quick.value, items},
    });
    if (!nextQuick.ok) {
      return timerRefusal('invalid', 'Invalid linked quick timer deletion');
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
