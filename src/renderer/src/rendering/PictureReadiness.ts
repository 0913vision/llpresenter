import {createContext} from 'react';

/** Reports when a staged picture has finished preparing its renderer. */
export const PictureReadiness = createContext<
  ((source: object) => void) | null
>(null);
