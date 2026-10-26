import type {LlpApi} from '@shared/ipc';
import type {TimerId} from '@shared/schema/ids';
import type {EditResult} from '@shared/schema/contentEdit';
import {MAX_TIMER_DEFINITIONS, MAX_TIMER_SECONDS} from '@shared/schema/timers';
import {nextTimerName} from '@shared/timerNames';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {withinLookupTimeout} from '@renderer/state/showOutput';

const SAVE_ATTEMPTS = 2;
export interface NewCountdown {
  readonly id: TimerId;
  readonly duration: number;
  readonly overrun: boolean;
}

export async function saveNewCountdown(
  api: LlpApi,
  timer: NewCountdown,
): Promise<EditResult> {
  const result = await pendingWritesOf(api).run<EditResult | null>({
    write: () => sendCountdown(api, timer),
    refused: null,
    sent: outcome =>
      outcome !== null &&
      (outcome.ok || outcome.error.reason === 'write-failed'),
  });
  if (result === null) throw new Error('Timer edits stopped for closing');
  return result;
}

async function sendCountdown(
  api: LlpApi,
  timer: NewCountdown,
  attempt = 0,
): Promise<EditResult> {
  if (
    !Number.isSafeInteger(timer.duration) ||
    timer.duration <= 0 ||
    timer.duration > MAX_TIMER_SECONDS
  ) {
    throw new Error('Invalid countdown duration');
  }
  const document = await withinLookupTimeout(() =>
    api.settings.get({name: 'timers'}),
  );
  if (document.name !== 'timers' || document.access !== 'editable') {
    throw new Error('Timer settings cannot be edited');
  }
  const existing = document.value.timers.find(item => item.id === timer.id);
  if (existing) {
    if (
      existing.kind !== 'countdown' ||
      existing.duration !== timer.duration ||
      (existing.overrun ?? true) !== timer.overrun
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
      timers: [...document.value.timers, {kind: 'countdown', name, ...timer}],
    },
  });
  if (result.ok || result.error.reason === 'write-failed') return result;
  if (result.error.reason === 'stale' && attempt + 1 < SAVE_ATTEMPTS) {
    return sendCountdown(api, timer, attempt + 1);
  }
  throw new Error(result.error.message);
}
