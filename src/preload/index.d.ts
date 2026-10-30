import type {LlpApi} from '@contracts/ipc/api';

declare global {
  interface Window {
    /** Missing outside Electron, for example in a plain browser preview. */
    llp?: LlpApi;
  }
}

export {};
