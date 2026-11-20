import {utilityProcess} from 'electron';
import {join} from 'node:path';
import type {Logger} from '../log';

/** Receives the sent NDI source in its own process, outside the sender. */
export function createNdiPreview(
  sourceName: string,
  send: (frame: Uint8Array) => void,
  log: Logger,
): {ack(): void; stop(): void} {
  const worker = utilityProcess.fork(
    join(__dirname, 'ndi/preview-receiver.cjs'),
    [],
    {serviceName: 'NDI preview receiver'},
  );
  let stopped = false;
  let spawned = false;
  const post = (message: object): void => {
    try {
      worker.postMessage(message);
    } catch (error) {
      log.warn('NDI preview unavailable', error);
    }
  };
  worker.once('spawn', () => {
    if (stopped) {
      worker.kill();
      return;
    }
    spawned = true;
    post({type: 'start', sourceName});
  });
  worker.on('exit', () => {
    spawned = false;
  });
  worker.on(
    'message',
    (message: {type: string; frame?: unknown; message?: string}) => {
      if (stopped) return;
      if (message.type === 'error') {
        log.warn('NDI preview unavailable', message.message);
      }
      if (
        message.type === 'frame' &&
        message.frame instanceof Uint8Array &&
        message.frame.length === 640 * 360 * 4
      ) {
        send(message.frame);
      }
    },
  );
  return {
    ack: () => {
      if (!stopped && spawned) post({type: 'ack'});
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (!spawned) return;
      post({type: 'stop'});
      setTimeout(() => worker.kill(), 2000).unref();
    },
  };
}
