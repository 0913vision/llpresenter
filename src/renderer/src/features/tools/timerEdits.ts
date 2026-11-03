import type {LlpApi} from '@contracts/ipc/api';
import {duplicateAfter} from '@core/common/duplicateAfter';
import type {TimerId} from '@core/schema/ids';
import type {EditResult} from '@core/schema/contentEdit';
import type {TimerDelete} from '@core/schema/timerDeletion';
import type {TimerRename} from '@core/schema/timerEdit';
import {TIMER_NAME_LIMIT} from '@core/schema/quickTimerEdit';
import {MAX_TIMER_DEFINITIONS} from '@core/schema/timers';
import {nextTimerName} from '@core/timers/timerNames';
import {prepareTimerEdit} from './timerEditPlan';
import type {TimerEditDraft} from '@core/timers/timerEditDraft';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {withinLookupTimeout} from '@renderer/session/showOutput';
import {
  validTimerConfiguration,
  type TimerConfiguration,
} from '@core/timers/timerConfiguration';

const SAVE_ATTEMPTS = 2;
export interface NewCountdown {
  readonly id: TimerId;
  readonly duration: number;
  readonly overrun: boolean;
}
export type NewTimer = TimerConfiguration & {readonly id: TimerId};

export async function saveNewCountdown(
  api: LlpApi,
  timer: NewCountdown,
): Promise<EditResult> {
  if (!validTimerConfiguration({kind: 'countdown', ...timer})) {
    throw new Error('Invalid countdown duration');
  }
  return saveNewTimer(api, {kind: 'countdown', ...timer});
}

export function deleteTimer(
  api: LlpApi,
  edit: TimerDelete,
): Promise<EditResult> {
  return writeTimerEdit(api, () => api.settings.edit(edit));
}

export function renameTimer(
  api: LlpApi,
  edit: TimerRename,
): Promise<EditResult> {
  return writeTimerEdit(api, () => api.settings.edit(edit));
}

/** A copy of one 타이머: its own id, the copy name, right after the original. */
export interface TimerCopy {
  readonly id: TimerId;
  readonly copyId: TimerId;
}

export function duplicateTimer(
  api: LlpApi,
  copy: TimerCopy,
): Promise<EditResult> {
  return writeTimerEdit(api, () => sendCopy(api, copy));
}

async function sendCopy(
  api: LlpApi,
  copy: TimerCopy,
  attempt = 0,
): Promise<EditResult> {
  const document = await withinLookupTimeout(() =>
    api.settings.get({name: 'timers'}),
  );
  if (document.name !== 'timers' || document.access !== 'editable') {
    throw new Error('Timer settings cannot be edited');
  }
  const timers = duplicateAfter(document.value.timers, copy, {
    limit: MAX_TIMER_DEFINITIONS,
    maxName: TIMER_NAME_LIMIT,
  });
  if (timers === document.value.timers) {
    return {ok: true, value: {id: 'timers', revision: document.revision}};
  }
  const result = await api.settings.edit({
    type: 'settings.update',
    name: 'timers',
    baseRevision: document.revision,
    value: {...document.value, timers},
  });
  if (result.ok || result.error.reason === 'write-failed') return result;
  if (result.error.reason === 'stale' && attempt + 1 < SAVE_ATTEMPTS) {
    return sendCopy(api, copy, attempt + 1);
  }
  throw new Error(result.error.message);
}

export function saveNewTimer(
  api: LlpApi,
  timer: NewTimer,
): Promise<EditResult> {
  return writeTimerEdit(api, () => sendTimer(api, timer));
}

async function writeTimerEdit(
  api: LlpApi,
  write: () => Promise<EditResult>,
): Promise<EditResult> {
  const result = await pendingWritesOf(api).run<EditResult | null>({
    write,
    refused: null,
    sent: outcome =>
      outcome !== null &&
      (outcome.ok || outcome.error.reason === 'write-failed'),
  });
  if (result === null) throw new Error('Timer edits stopped for closing');
  return result;
}

async function sendTimer(
  api: LlpApi,
  timer: NewTimer,
  attempt = 0,
): Promise<EditResult> {
  if (!validTimerConfiguration(timer)) {
    throw new Error('Invalid timer configuration');
  }
  const document = await withinLookupTimeout(() =>
    api.settings.get({name: 'timers'}),
  );
  if (document.name !== 'timers' || document.access !== 'editable') {
    throw new Error('Timer settings cannot be edited');
  }
  const existing = document.value.timers.find(item => item.id === timer.id);
  if (existing) {
    const saved = new Map<string, unknown>(Object.entries(existing));
    if (
      Object.entries(timer).some(
        ([key, value]) =>
          (key === 'overrun' ? (saved.get(key) ?? true) : saved.get(key)) !==
          value,
      )
    ) {
      throw new Error('The timer ID is already in use');
    }
    return {ok: true, value: {id: timer.id, revision: document.revision}};
  }
  if (document.value.timers.length >= MAX_TIMER_DEFINITIONS) {
    throw new Error('The timer list is full');
  }
  const name = nextTimerName(document.value.timers.map(timer => timer.name));
  const result = await api.settings.edit({
    type: 'settings.update',
    name: 'timers',
    baseRevision: document.revision,
    value: {
      ...document.value,
      timers: [...document.value.timers, {name, ...timer}],
    },
  });
  if (result.ok || result.error.reason === 'write-failed') return result;
  if (result.error.reason === 'stale' && attempt + 1 < SAVE_ATTEMPTS) {
    return sendTimer(api, timer, attempt + 1);
  }
  throw new Error(result.error.message);
}

/** One 타이머's new configuration; its id and name stay. */
export interface TimerReconfiguration {
  readonly id: TimerId;
  readonly draft: TimerEditDraft;
}

export function saveTimerEdit(
  api: LlpApi,
  edit: TimerReconfiguration,
): Promise<EditResult> {
  return writeTimerEdit(api, () => sendReconfiguration(api, edit));
}

async function sendReconfiguration(
  api: LlpApi,
  edit: TimerReconfiguration,
  attempt = 0,
): Promise<EditResult> {
  const document = await withinLookupTimeout(() =>
    api.settings.get({name: 'timers'}),
  );
  if (document.name !== 'timers') throw new Error('Not the timer settings');
  const plan = prepareTimerEdit(document, edit.id, edit.draft);
  if (plan.kind === 'unchanged') {
    return {ok: true, value: {id: 'timers', revision: plan.revision}};
  }
  if (plan.kind === 'refused') {
    throw new Error(`The timer edit was refused: ${plan.reason}`);
  }
  const result = await api.settings.edit(plan.edit);
  if (result.ok || result.error.reason === 'write-failed') return result;
  if (result.error.reason === 'stale' && attempt + 1 < SAVE_ATTEMPTS) {
    return sendReconfiguration(api, edit, attempt + 1);
  }
  throw new Error(result.error.message);
}
