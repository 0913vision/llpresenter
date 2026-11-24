import type {ImportGlobFunction} from 'vite/types/importGlob.d.ts';

declare global {
  interface ImportMeta {
    readonly glob: ImportGlobFunction;
  }
}
