import {useEffect, useState} from 'react';
import {sizeClassFor} from '@renderer/ui/panels/sizeClass';
import {type SizeClass} from '@core/schema/app/appConfig';

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
