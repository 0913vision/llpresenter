import type {LlpApi} from '@contracts/ipc/api';
import type {MediaDocument} from '@core/schema/mediaEdit';

/**
 * Subscribes before reading and accepts only strictly newer media revisions.
 * Reports a read failure only before any document has been accepted.
 *
 * @returns A disposer that unsubscribes and ignores late replies and pushes.
 */
export function subscribeMediaDocument(
  media: Pick<LlpApi['media'], 'get' | 'subscribe'>,
  publish: (document: MediaDocument) => void,
  onError: (cause: unknown) => void,
): () => void {
  let active = true;
  let revision = -1;
  const accept = (next: MediaDocument): void => {
    if (!active || next.revision <= revision) return;
    revision = next.revision;
    publish(next);
  };
  const stop = media.subscribe(accept);
  media.get().then(accept, (cause: unknown) => {
    if (!active || revision >= 0) return;
    onError(cause);
  });
  return () => {
    active = false;
    stop();
  };
}
