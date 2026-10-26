/**
 * How the control window answered main's flush request before closing:
 * `flushed` and `refused` are its result; `no-reply` is a missing answer within
 * `APP_FLUSH_LIMITS.timeoutMs`, a malformed one, or a lost window.
 */
export type FlushOutcome = 'flushed' | 'refused' | 'no-reply';

/** What closing does after a flush: close, or stay open and warn. */
export type CloseStep = 'close' | 'warn';

/**
 * The one close rule that main and the control window share (a proposal that
 * awaits the user): a refused flush keeps the window open with a warning that
 * offers 그래도 닫기, so a draft is never dropped silently; any other outcome
 * closes.
 */
export function closeStepAfter(outcome: FlushOutcome): CloseStep {
  return outcome === 'refused' ? 'warn' : 'close';
}
