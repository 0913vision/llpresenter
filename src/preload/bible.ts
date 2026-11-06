import {bibleApi} from '@contracts/ipc/bible';
import type {IpcPort} from '@contracts/ipc/endpoint';

/** Builds the Bible bridge, including the optional local AI calls. */
export function biblePreload(port: IpcPort) {
  return bibleApi(port);
}
