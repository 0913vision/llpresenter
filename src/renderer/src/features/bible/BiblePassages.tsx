import {useLayoutEffect} from 'react';
import type {Notice} from '@renderer/ui/popups/notices';
import {installPassageSplitter} from './passageSplitter';
import {usePassageSplitter} from './usePassageSplitter';

/** Keeps the splitter of this window current. */
export function BiblePassages({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): null {
  const splitter = usePassageSplitter(onProblem);
  useLayoutEffect(() => installPassageSplitter(splitter), [splitter]);
  return null;
}
