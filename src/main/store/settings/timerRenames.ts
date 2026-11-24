import {editableTimers, timerRefusal} from './editableTimers';
import type {Result} from '@core/common/result';
import type {EditFailure, EditSuccess} from '@core/schema/services/contentEdit';
import {isKnownQuickItem} from '@core/schema/tools/quick';
import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/app/settingsDocuments';
import type {TimerRename} from '@core/schema/tools/timerEdit';

interface PreparedRename {
  readonly documents: readonly SettingsDocument[];
  readonly applied: EditSuccess;
}

/**
 * Prepares the rename of a timer, with the 빠른 타이머 that uses it, or refuses it.
 */
export function prepareTimerRename(
  documents: ReadonlyMap<SettingsName, SettingsDocument>,
  edit: TimerRename,
): Result<PreparedRename, EditFailure> {
  const editable = editableTimers(documents);
  if (!editable.ok) return editable;
  const {timers, quick} = editable.value;
  const timer = timers.value.timers.find(timer => timer.id === edit.timerId);
  if (!timer) return timerRefusal('not-found', 'The timer is missing');
  const items = quick.value.items.map(row =>
    isKnownQuickItem(row) &&
    row.kind === 'timer' &&
    row.ref === timer.id &&
    row.name !== edit.timerName
      ? {...row, name: edit.timerName}
      : row,
  );
  const quickChanged = items.some(
    (row, index) => row !== quick.value.items[index],
  );
  if (quickChanged && quick.access !== 'editable') {
    return timerRefusal('read-only', 'Quick timer names cannot be edited');
  }
  const next: SettingsDocument[] = [];
  let revision = timers.revision;
  if (timer.name !== edit.timerName) {
    const parsed = parseSettingsDocument({
      ...timers,
      revision: timers.revision + 1,
      value: {
        ...timers.value,
        timers: timers.value.timers.map(row =>
          row.id === timer.id ? {...row, name: edit.timerName} : row,
        ),
      },
    });
    if (!parsed.ok) return timerRefusal('invalid', 'Invalid renamed timer');
    next.push(parsed.value);
    revision++;
  }
  if (quickChanged) {
    const parsed = parseSettingsDocument({
      ...quick,
      revision: quick.revision + 1,
      value: {...quick.value, items},
    });
    if (!parsed.ok) {
      return timerRefusal('invalid', 'Invalid renamed quick timers');
    }
    next.push(parsed.value);
  }
  return {
    ok: true,
    value: {documents: next, applied: {id: timer.id, revision}},
  };
}
