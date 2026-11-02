import type {EventEmitter} from 'node:events';

/**
 * Calls `announce` when a page has loaded again after its renderer process
 * died, so the window can say it came back. A first load, or a load after a
 * clean exit, says nothing.
 *
 * @returns A function that stops listening.
 */
export function announceReloadAfterCrash(
  contents: Pick<EventEmitter, 'on' | 'removeListener'>,
  announce: () => void,
): () => void {
  let crashed = false;
  const gone = (_event: unknown, details: {readonly reason: string}): void => {
    if (details.reason !== 'clean-exit') crashed = true;
  };
  const loaded = (): void => {
    if (!crashed) return;
    crashed = false;
    announce();
  };
  contents.on('render-process-gone', gone);
  contents.on('did-finish-load', loaded);
  return () => {
    contents.removeListener('render-process-gone', gone);
    contents.removeListener('did-finish-load', loaded);
  };
}
