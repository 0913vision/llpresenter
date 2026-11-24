import {createContext} from 'react';

export interface PreviewSizing {
  readonly ratio: number;
  readonly save: (ratio: number) => void;
}

export const PreviewSizingContext = createContext<PreviewSizing | null>(null);
