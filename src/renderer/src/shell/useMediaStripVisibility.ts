import {useEffect, useState} from 'react';
import type {SizeClass} from './sizeClass';

const DEFAULT_MEDIA_MIN_HEIGHT = 900;

/** Window defaults follow size and height until the operator makes a choice. */
export function useMediaStripVisibility(sizeClass: SizeClass) {
  const [height, setHeight] = useState(() => window.innerHeight);
  const [choice, setChoice] = useState<boolean>();
  useEffect(() => {
    const resize = (): void => setHeight(window.innerHeight);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return {
    visible:
      choice ?? (sizeClass !== 'narrow' && height >= DEFAULT_MEDIA_MIN_HEIGHT),
    setVisible: setChoice,
  };
}
