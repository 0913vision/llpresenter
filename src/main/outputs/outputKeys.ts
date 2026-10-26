import type {BrowserWindow, Event, Input, WebContents} from 'electron';
import type {Logger} from '../log';

const MAX_PENDING_OUTPUT_KEYS = 64;

export type OutputKeyControl = Pick<BrowserWindow, 'isDestroyed'> & {
  readonly webContents: Pick<WebContents, 'isDestroyed' | 'executeJavaScript'>;
};

/** Forwards output-window keys without moving focus or raising the control. */
export function forwardOutputKeys(
  source: Pick<WebContents, 'on' | 'removeListener'>,
  control: OutputKeyControl,
  log: Logger,
): () => void {
  const contents = control.isDestroyed() ? null : control.webContents;
  const pending: string[] = [];
  let disposed = false;
  let sending = false;
  let reported = false;
  const report = (error: unknown): void => {
    if (reported || disposed) return;
    reported = true;
    log.error('could not forward an output key to the control window', error);
  };
  const send = async (): Promise<void> => {
    if (sending || contents === null) return;
    sending = true;
    try {
      while (!disposed && pending.length > 0) {
        const script = pending.shift();
        if (script === undefined) break;
        if (control.isDestroyed() || contents.isDestroyed()) break;
        try {
          await contents.executeJavaScript(script);
        } catch (error) {
          report(error);
        }
      }
    } finally {
      pending.length = 0;
      sending = false;
    }
  };
  const receive = (event: Event, input: Input): void => {
    if (disposed || contents === null || control.isDestroyed()) return;
    if (input.type !== 'keyDown' && input.type !== 'keyUp') return;
    event.preventDefault();
    if (input.isAutoRepeat) return;
    if (pending.length >= MAX_PENDING_OUTPUT_KEYS) {
      report(new Error('Output key forwarding queue is full'));
      return;
    }
    const init = {
      key: input.key,
      code: input.code,
      location: input.location,
      ctrlKey: input.control,
      altKey: input.alt,
      shiftKey: input.shift,
      metaKey: input.meta,
      isComposing: input.isComposing,
      modifierNumLock: input.modifiers.includes('numLock'),
      bubbles: true,
      cancelable: true,
    };
    pending.push(
      `(document.activeElement ?? window).dispatchEvent(new KeyboardEvent(${JSON.stringify(input.type.toLowerCase())},${JSON.stringify(init)}))`,
    );
    send().catch(report);
  };
  source.on('before-input-event', receive);
  return () => {
    disposed = true;
    pending.length = 0;
    source.removeListener('before-input-event', receive);
  };
}
