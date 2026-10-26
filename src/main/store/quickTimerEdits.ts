import type {EditFailure, EditSuccess} from '@shared/schema/contentEdit';
import type {Result} from '@shared/result';
import {isKnownQuickItem, MAX_QUICK_ITEMS} from '@shared/schema/quick';
import {
  MAX_TIMER_DEFINITIONS,
  type QuickTimerEdit,
} from '@shared/schema/quickTimerEdit';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@shared/schema/settingsDocuments';

type QuickDocument = Extract<SettingsDocument, {name: 'quick'}>;
type TimerDocument = Extract<SettingsDocument, {name: 'timers'}>;

interface TimerDocuments {
  readonly quick: QuickDocument;
  readonly timers: TimerDocument;
}

interface PreparedTimers {
  readonly documents: readonly SettingsDocument[];
  readonly applied: EditSuccess;
}

type PreparedResult = Result<PreparedTimers, EditFailure>;

function refuse(
  reason: 'invalid' | 'not-found' | 'read-only',
  message: string,
): PreparedResult {
  return {ok: false, error: {reason, message}};
}

function unchanged({quick}: TimerDocuments, id: string): PreparedResult {
  return {
    ok: true,
    value: {documents: [], applied: {id, revision: quick.revision}},
  };
}

function prepared(
  current: TimerDocuments,
  values: {
    readonly quick: QuickDocument['value'];
    readonly timers: TimerDocument['value'];
  },
  id: string,
): PreparedResult {
  const quick = parseSettingsDocument({
    ...current.quick,
    value: values.quick,
    revision: current.quick.revision + 1,
  });
  const timers = parseSettingsDocument({
    ...current.timers,
    value: values.timers,
    revision: current.timers.revision + 1,
  });
  if (!quick.ok || !timers.ok) {
    return refuse('invalid', 'Invalid quick timer documents');
  }
  return {
    ok: true,
    value: {
      documents: [timers.value, quick.value],
      applied: {id, revision: quick.value.revision},
    },
  };
}

function unusedTimerName({quick, timers}: TimerDocuments): string {
  const names = new Set([
    ...timers.value.timers.map(timer => timer.name),
    ...quick.value.items
      .filter(item => item.kind === 'timer')
      .map(item => item.name),
  ]);
  let index = 1;
  while (names.has(`타이머 ${index}`)) index++;
  return `타이머 ${index}`;
}

function createTimer(
  current: TimerDocuments,
  edit: Extract<QuickTimerEdit, {type: 'quick.timer.create'}>,
): PreparedResult {
  const {quick, timers} = current;
  if (
    quick.value.items.some(item => item.id === String(edit.timerId)) ||
    timers.value.timers.some(timer => timer.id === String(edit.quickItemId))
  ) {
    return refuse('invalid', 'A quick timer ID is already in use');
  }
  const item = quick.value.items.find(item => item.id === edit.quickItemId);
  const timer = timers.value.timers.find(timer => timer.id === edit.timerId);
  if (item || timer) {
    if (
      item &&
      isKnownQuickItem(item) &&
      item.kind === 'timer' &&
      item.ref === edit.timerId &&
      timer?.kind === 'countdown' &&
      timer.duration === edit.duration
    ) {
      return unchanged(current, edit.quickItemId);
    }
    return refuse('invalid', 'A quick timer ID is already in use');
  }
  if (
    quick.value.items.length >= MAX_QUICK_ITEMS ||
    timers.value.timers.length >= MAX_TIMER_DEFINITIONS
  ) {
    return refuse('invalid', 'The quick timer list is full');
  }
  const name = unusedTimerName(current);
  return prepared(
    current,
    {
      quick: {
        ...quick.value,
        items: [
          ...quick.value.items,
          {id: edit.quickItemId, kind: 'timer', name, ref: edit.timerId},
        ],
      },
      timers: {
        ...timers.value,
        timers: [
          ...timers.value.timers,
          {id: edit.timerId, kind: 'countdown', name, duration: edit.duration},
        ],
      },
    },
    edit.quickItemId,
  );
}

function renameTimer(
  current: TimerDocuments,
  edit: Extract<QuickTimerEdit, {type: 'quick.timer.rename'}>,
): PreparedResult {
  const {quick, timers} = current;
  const item = quick.value.items.find(item => item.id === edit.quickItemId);
  if (!item || !isKnownQuickItem(item) || item.kind !== 'timer') {
    return refuse('not-found', 'The quick timer row is missing');
  }
  const timer = timers.value.timers.find(timer => timer.id === item.ref);
  if (!timer) return refuse('not-found', 'The timer is missing');
  if (
    quick.value.items.filter(
      row =>
        isKnownQuickItem(row) && row.kind === 'timer' && row.ref === timer.id,
    ).length > 1
  ) {
    return refuse('invalid', 'The quick timer needs a separate definition');
  }
  if (item.name === edit.timerName && timer.name === edit.timerName) {
    return unchanged(current, item.id);
  }
  return prepared(
    current,
    {
      quick: {
        ...quick.value,
        items: quick.value.items.map(row =>
          row.id === item.id ? {...row, name: edit.timerName} : row,
        ),
      },
      timers: {
        ...timers.value,
        timers: timers.value.timers.map(row =>
          row.id === timer.id ? {...row, name: edit.timerName} : row,
        ),
      },
    },
    item.id,
  );
}

export function prepareQuickTimerEdit(
  documents: ReadonlyMap<string, SettingsDocument>,
  edit: QuickTimerEdit,
): PreparedResult {
  const quick = documents.get('quick');
  const timers = documents.get('timers');
  if (quick?.name !== 'quick' || timers?.name !== 'timers') {
    return refuse('not-found', 'Quick timer settings are unavailable');
  }
  if (quick.access !== 'editable' || timers.access !== 'editable') {
    return refuse(
      'read-only',
      'A newer app version wrote the quick timer settings',
    );
  }
  const current = {quick, timers};
  return edit.type === 'quick.timer.create'
    ? createTimer(current, edit)
    : renameTimer(current, edit);
}
