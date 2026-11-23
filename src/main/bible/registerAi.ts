import {bibleEndpoints} from '@contracts/ipc/bible';
import {IpcHost} from '../base/ipcHost';
import type {Logger} from '../base/log';
import {createChooser} from './llm/chooser';
import {ChooserQueue} from './llm/queue';
import {LlmServer} from './llm/server';

/** Owns the optional local server and each window's cancellable chooser work. */
export function registerBibleAi({log}: {readonly log: Logger}): () => void {
  const ipc = new IpcHost(log);
  const server = new LlmServer({
    onStatusChange: state => ipc.push(bibleEndpoints.llmStatusChanged, state),
  });
  const queue = new ChooserQueue((request, signal) =>
    createChooser({endpoint: server.endpoint, signal})(
      request.fullText,
      request.remaining,
      request.candidates,
    ),
  );
  ipc.query(bibleEndpoints.llmStatus, () => server.getState());
  ipc.request(
    bibleEndpoints.chooseBoundary,
    async (request, {contents: sender}) => {
      if (!server.getState().available) {
        throw new Error('Local LLM unavailable');
      }
      const cancel = (): void => {
        queue.cancel(sender.id);
      };
      sender.once('destroyed', cancel);
      try {
        return await queue.enqueue(sender.id, request);
      } finally {
        sender.removeListener('destroyed', cancel);
      }
    },
  );
  ipc.request(bibleEndpoints.cancelBoundary, ({lookupId}, {contents}) =>
    queue.cancel(contents.id, lookupId),
  );
  server
    .start()
    .catch((error: unknown) => log.error('could not start local LLM', error));
  return () => {
    queue.stop();
    server.stop();
    ipc.close();
  };
}
