import {BrowserWindow, ipcMain} from 'electron';
import {bibleEndpoints} from '@contracts/ipc/bible';
import {parseBibleAiCancel, parseBibleAiRequest} from '@core/schema/bibleAi';
import type {Logger} from '../log';
import {createChooser} from './llm/chooser';
import {ChooserQueue} from './llm/queue';
import {LlmServer} from './llm/server';

/** Owns the optional local server and each window's cancellable chooser work. */
export function registerBibleAi({log}: {readonly log: Logger}): () => void {
  const server = new LlmServer({
    onStatusChange: state => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (window.isDestroyed() || window.webContents.isDestroyed()) continue;
        try {
          window.webContents.send(
            bibleEndpoints.llmStatusChanged.channel,
            state,
          );
        } catch (error: unknown) {
          log.warn('could not send local LLM status', error);
        }
      }
    },
  });
  const queue = new ChooserQueue((request, signal) =>
    createChooser({endpoint: server.endpoint, signal})(
      request.fullText,
      request.remaining,
      request.candidates,
    ),
  );
  ipcMain.handle(bibleEndpoints.llmStatus.channel, () => server.getState());
  ipcMain.handle(
    bibleEndpoints.chooseBoundary.channel,
    async (event, value: unknown) => {
      const parsed = parseBibleAiRequest(value);
      if (!parsed.ok) throw new Error('Invalid Bible boundary request');
      if (!server.getState().available) {
        throw new Error('Local LLM unavailable');
      }
      const sender = event.sender;
      const cancel = (): void => {
        queue.cancel(sender.id);
      };
      sender.once('destroyed', cancel);
      try {
        return await queue.enqueue(sender.id, parsed.value);
      } finally {
        sender.removeListener('destroyed', cancel);
      }
    },
  );
  ipcMain.handle(
    bibleEndpoints.cancelBoundary.channel,
    (event, value: unknown) => {
      const parsed = parseBibleAiCancel(value);
      if (!parsed.ok) throw new Error('Invalid Bible boundary cancellation');
      return queue.cancel(event.sender.id, parsed.value.lookupId);
    },
  );
  server
    .start()
    .catch((error: unknown) => log.error('could not start local LLM', error));
  return () => {
    queue.stop();
    server.stop();
    ipcMain.removeHandler(bibleEndpoints.chooseBoundary.channel);
    ipcMain.removeHandler(bibleEndpoints.cancelBoundary.channel);
    ipcMain.removeHandler(bibleEndpoints.llmStatus.channel);
  };
}
