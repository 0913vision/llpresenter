import type {Result} from '@core/common/result';
import type {EditFailure, EditSuccess} from '@core/schema/contentEdit';
import {isKnownQuickItem} from '@core/schema/quick';
import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/settingsDocuments';
import type {TimerRename} from '@core/schema/timerEdit';

interface PreparedRename {
  readonly documents: readonly SettingsDocument[];
  readonly applied: EditSuccess;
}

const refuse = (
  reason: 'not-found' | 'read-only' | 'invalid',
  message: string,
): Result<PreparedRename, EditFailure> => ({
  ok: false,
  error: {reason, message},
});

export function prepareTimerRename(
  documents: ReadonlyMap<SettingsName, SettingsDocument>,
  edit: TimerRename,
): Result<PreparedRename, EditFailure> {
  const timers = documents.get('timers');
  const quick = documents.get('quick');
  if (timers?.name !== 'timers' || quick?.name !== 'quick') {
    return refuse('not-found', 'Timer settings are unavailable');
  }
  if (timers.access !== 'editable') {
    return refuse('read-only', 'Timer settings cannot be edited');
  }
  const timer = timers.value.timers.find(timer => timer.id === edit.timerId);
  if (!timer) return refuse('not-found', 'The timer is missing');
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
    return refuse('read-only', 'Quick timer names cannot be edited');
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
    if (!parsed.ok) return refuse('invalid', 'Invalid renamed timer');
    next.push(parsed.value);
    revision++;
  }
  if (quickChanged) {
    const parsed = parseSettingsDocument({
      ...quick,
      revision: quick.revision + 1,
      value: {...quick.value, items},
    });
    if (!parsed.ok) return refuse('invalid', 'Invalid renamed quick timers');
    next.push(parsed.value);
  }
  return {
    ok: true,
    value: {documents: next, applied: {id: timer.id, revision}},
  };
}
