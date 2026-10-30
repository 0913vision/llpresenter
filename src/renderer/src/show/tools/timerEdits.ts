import type {LlpApi} from '@contracts/ipc/api';
import type {TimerId} from '@core/schema/ids';
import type {EditResult} from '@core/schema/contentEdit';
import {MAX_TIMER_DEFINITIONS} from '@core/schema/timers';
import {nextTimerName} from '@core/timers/timerNames';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {withinLookupTimeout} from '@renderer/state/showOutput';
import {
  validTimerConfiguration,
  type TimerConfiguration,
} from './timerConfiguration';

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

export async function saveNewTimer(
  api: LlpApi,
  timer: NewTimer,
): Promise<EditResult> {
  const result = await pendingWritesOf(api).run<EditResult | null>({
    write: () => sendTimer(api, timer),
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
