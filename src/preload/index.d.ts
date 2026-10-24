import type {LlpApi} from '../shared/ipc';

declare global {
  interface Window {
    /** Missing outside Electron, for example in a plain browser preview. */
    llp?: LlpApi;
  }
}

export {};
