import {useEffect, useState} from 'react';
import {sizeClassFor, type SizeClass} from '../../ui/sizeClass';

/** Re-renders only when the window crosses a size class boundary. */
export function useSizeClass(): SizeClass {
  const [value, setValue] = useState<SizeClass>(() =>
    sizeClassFor(window.innerWidth),
  );
  useEffect(() => {
    const onResize = (): void => setValue(sizeClassFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return value;
}
