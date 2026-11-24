import type {Result} from '@core/common/result';
import type {EditFailure} from '@core/schema/services/contentEdit';
import type {
  SettingsDocument,
  SettingsName,
} from '@core/schema/app/settingsDocuments';

/** The timers file and the 빠른 실행 file, which a timer change edits together. */
export interface TimerDocuments {
  readonly timers: Extract<SettingsDocument, {name: 'timers'}>;
  readonly quick: Extract<SettingsDocument, {name: 'quick'}>;
}

/** Why a timer change is refused, as an edit failure. */
export function timerRefusal(
  reason: 'not-found' | 'read-only' | 'invalid',
  message: string,
): {readonly ok: false; readonly error: EditFailure} {
  return {ok: false, error: {reason, message}};
}

/**
 * The timers and the 빠른 실행 items for changing a timer, or why they can't
 * be changed: one of them is not read, or the timers file is of a newer
 * version.
 */
export function editableTimers(
  documents: ReadonlyMap<SettingsName, SettingsDocument>,
): Result<TimerDocuments, EditFailure> {
  const timers = documents.get('timers');
  const quick = documents.get('quick');
  if (timers?.name !== 'timers' || quick?.name !== 'quick') {
    return timerRefusal('not-found', 'Timer settings are unavailable');
  }
  if (timers.access !== 'editable') {
    return timerRefusal('read-only', 'Timer settings cannot be edited');
  }
  return {ok: true, value: {timers, quick}};
}
