/**
 * How the control window answered main's flush request before closing:
 * `flushed` and `refused` are its result; `forced` is 강제로 닫기 before an
 * answer; `no-reply` is a missing answer within `APP_FLUSH_LIMITS.timeoutMs`,
 * a malformed one, or a lost window.
 */
export type FlushOutcome = 'flushed' | 'refused' | 'forced' | 'no-reply';

/** What closing does after a flush: close, or stay open and offer a retry. */
export type CloseStep = 'close' | 'warn';

/**
 * The one close rule that main and the control window share (user decision,
 * "Closing the app while edits are still being saved"): a refused flush keeps
 * the window open, and its 저장 중 dialog offers 다시 시도 and 강제로 닫기, so
 * an edit is never dropped unless the operator chooses to; any other outcome
 * closes.
 */
export function closeStepAfter(outcome: FlushOutcome): CloseStep {
  return outcome === 'refused' ? 'warn' : 'close';
}
