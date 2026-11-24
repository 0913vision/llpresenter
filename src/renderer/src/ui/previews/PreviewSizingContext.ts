import {createContext} from 'react';

/** How much of its column the 미리보기 takes, and how a drag keeps a new share. */
export interface PreviewSizing {
  readonly ratio: number;
  readonly save: (ratio: number) => void;
}

/** The 미리보기 sizing of the window; null where previews are not resized. */
export const PreviewSizingContext = createContext<PreviewSizing | null>(null);
