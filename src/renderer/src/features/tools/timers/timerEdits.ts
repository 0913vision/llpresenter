import type {LlpApi} from '@contracts/ipc/api';
import {duplicateAfter} from '@core/common/duplicateAfter';
import type {TimerId} from '@core/schema/common/ids';
import type {EditResult} from '@core/schema/services/contentEdit';
import type {TimerDelete} from '@core/schema/tools/timerDeletion';
import type {TimerRename} from '@core/schema/tools/timerEdit';
import {NAME_LIMIT} from '@core/schema/common/primitives';
import {MAX_TIMER_DEFINITIONS} from '@core/schema/tools/timers';
import {
  nextTimerName,
  type TimerEditDraft,
  validTimerConfiguration,
  type TimerConfiguration,
} from '@core/timers';
import {prepareTimerEdit} from './timerEditPlan';
import {
  editableSettings,
  gatedSettingsWrite,
  readSettings,
  unchangedSettings,
  writeSettings,
} from '@renderer/session/settingsWrites';

/**
 * A countdown to make: its id, its duration in seconds and whether it runs on
 * past 0.
 */
export interface NewCountdown {
  readonly id: TimerId;
  readonly duration: number;
  readonly overrun: boolean;
}
/** A 타이머 of any kind to make, with its id. */
export type NewTimer = TimerConfiguration & {readonly id: TimerId};

/**
 * Adds a new countdown to the timers file; throws when its duration is invalid.
 */
export async function saveNewCountdown(
  api: LlpApi,
  timer: NewCountdown,
): Promise<EditResult> {
  if (!validTimerConfiguration({kind: 'countdown', ...timer})) {
    throw new Error('Invalid countdown duration');
  }
  return saveNewTimer(api, {kind: 'countdown', ...timer});
}

/** Deletes a 타이머 from the timers file. */
export function deleteTimer(
  api: LlpApi,
  edit: TimerDelete,
): Promise<EditResult> {
  return gatedSettingsWrite(api, () => api.settings.edit(edit));
}

/** Renames a 타이머 in the timers file. */
export function renameTimer(
  api: LlpApi,
  edit: TimerRename,
): Promise<EditResult> {
  return gatedSettingsWrite(api, () => api.settings.edit(edit));
}

/** A copy of one 타이머: its own id, the copy name, right after the original. */
export interface TimerCopy {
  readonly id: TimerId;
  readonly copyId: TimerId;
}

/** Adds a copy of a 타이머 right after the original, unless the list is full. */
export function duplicateTimer(
  api: LlpApi,
  copy: TimerCopy,
): Promise<EditResult> {
  return writeSettings(api, async () => {
    const document = await editableSettings(api, 'timers');
    const timers = duplicateAfter(document.value.timers, copy, {
      limit: MAX_TIMER_DEFINITIONS,
      maxName: NAME_LIMIT,
    });
    return timers === document.value.timers
      ? unchangedSettings(document)
      : {
          type: 'settings.update',
          name: 'timers',
          baseRevision: document.revision,
          value: {...document.value, timers},
        };
  });
}

/**
 * Adds a new 타이머 to the timers file; rejects when its configuration is invalid.
 */
export function saveNewTimer(
  api: LlpApi,
  timer: NewTimer,
): Promise<EditResult> {
  if (!validTimerConfiguration(timer)) {
    return Promise.reject(new Error('Invalid timer configuration'));
  }
  return writeSettings(api, async () => {
    const document = await editableSettings(api, 'timers');
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
      return unchangedSettings(document, timer.id);
    }
    if (document.value.timers.length >= MAX_TIMER_DEFINITIONS) {
      throw new Error('The timer list is full');
    }
    const name = nextTimerName(document.value.timers.map(item => item.name));
    return {
      type: 'settings.update',
      name: 'timers',
      baseRevision: document.revision,
      value: {
        ...document.value,
        timers: [...document.value.timers, {name, ...timer}],
      },
    };
  });
}

/** One 타이머's new configuration; its id and name stay. */
export interface TimerReconfiguration {
  readonly id: TimerId;
  readonly draft: TimerEditDraft;
}

/** Saves the new configuration of one 타이머, keeping its id and name. */
export function saveTimerEdit(
  api: LlpApi,
  edit: TimerReconfiguration,
): Promise<EditResult> {
  return writeSettings(api, async () => {
    const document = await readSettings(api, 'timers');
    const plan = prepareTimerEdit(document, edit.id, edit.draft);
    if (plan.kind === 'unchanged') {
      return {ok: true, value: {id: 'timers', revision: plan.revision}};
    }
    if (plan.kind === 'refused') {
      throw new Error(`The timer edit was refused: ${plan.reason}`);
    }
    return plan.edit;
  });
}
