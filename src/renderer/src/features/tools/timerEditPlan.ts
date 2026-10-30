import type {TimerId} from '@core/schema/ids';
import type {Timer} from '@core/schema/timers';
import {
  parseSettingsEdit,
  type SettingsDocument,
  type SettingsEdit,
} from '@core/schema/settingsDocuments';
import {
  timerTimeReason,
  validTimerConfiguration,
} from '@core/timers/timerConfiguration';
import type {TimerEditDraft} from '@core/timers/timerEditDraft';

type TimerDocument = Extract<SettingsDocument, {name: 'timers'}>;
type TimerUpdate = Extract<
  SettingsEdit,
  {type: 'settings.update'; name: 'timers'}
>;

export type TimerEditPlan =
  | {readonly kind: 'unchanged'; readonly revision: number}
  | {readonly kind: 'update'; readonly edit: TimerUpdate}
  | {
      readonly kind: 'refused';
      readonly reason: 'read-only' | 'not-found' | 'invalid';
    };

function matches(timer: Timer, draft: TimerEditDraft): boolean {
  switch (draft.kind) {
    case 'countdown':
      return (
        timer.kind === draft.kind &&
        timer.duration === draft.duration &&
        (timer.overrun ?? true) === draft.overrun
      );
    case 'countdownTo':
      return (
        timer.kind === draft.kind &&
        timer.date === draft.date &&
        timer.time === draft.time &&
        (timer.overrun ?? true) === draft.overrun
      );
    case 'elapsed':
      return timer.kind === draft.kind && timer.start === draft.start;
    case 'elapsedFrom':
      return timer.kind === draft.kind && timer.time === draft.time;
    case 'clock':
      return timer.kind === draft.kind;
  }
}

function configurationFields(draft: TimerEditDraft): TimerEditDraft {
  switch (draft.kind) {
    case 'countdown':
      return {
        kind: draft.kind,
        duration: draft.duration,
        overrun: draft.overrun,
      };
    case 'countdownTo':
      return {
        kind: draft.kind,
        date: draft.date,
        time: draft.time,
        overrun: draft.overrun,
      };
    case 'elapsed':
      return {kind: draft.kind, start: draft.start};
    case 'elapsedFrom':
      return {kind: draft.kind, time: draft.time};
    case 'clock':
      return {kind: draft.kind};
  }
}

export function prepareTimerEdit(
  document: TimerDocument,
  timerId: TimerId,
  draft: TimerEditDraft,
): TimerEditPlan {
  if (document.access !== 'editable') {
    return {kind: 'refused', reason: 'read-only'};
  }
  const timer = document.value.timers.find(item => item.id === timerId);
  if (!timer) return {kind: 'refused', reason: 'not-found'};
  if (draft.kind === 'elapsedFrom' && timer.kind !== 'elapsedFrom') {
    return {kind: 'refused', reason: 'invalid'};
  }
  const valid =
    draft.kind === 'elapsedFrom'
      ? timerTimeReason(draft.time) === undefined
      : validTimerConfiguration(draft);
  if (!valid) return {kind: 'refused', reason: 'invalid'};
  if (matches(timer, draft)) {
    return {kind: 'unchanged', revision: document.revision};
  }
  const parsed = parseSettingsEdit({
    type: 'settings.update',
    name: 'timers',
    baseRevision: document.revision,
    value: {
      ...document.value,
      timers: document.value.timers.map(item =>
        item.id === timerId
          ? {...configurationFields(draft), id: item.id, name: item.name}
          : item,
      ),
    },
  });
  if (
    !parsed.ok ||
    parsed.value.type !== 'settings.update' ||
    parsed.value.name !== 'timers'
  ) {
    return {kind: 'refused', reason: 'invalid'};
  }
  return {kind: 'update', edit: parsed.value};
}
