/**
 * The outcome of work that can fail, such as reading a file: a value, or an
 * error that says why. Results cross IPC where exceptions can't.
 */
export type Result<T, E> =
  | {readonly ok: true; readonly value: T}
  | {readonly ok: false; readonly error: E};
