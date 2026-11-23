import {useMemo} from 'react';
import {inScreenOrder, type Screen} from '@core/schema/screens';
import type {Notice} from '@renderer/ui/notices';
import {useSettingsDocument} from './useSettingsDocument';

/**
 * The screens as every list shows them: 청중, 무대, 방송, each kind in its
 * saved order. Null until they are read.
 */
export function useScreenList(
  onProblem: ((notice: Notice) => void) | undefined,
  /** Reads nothing while false, as for a workspace that is not shown. */
  active = true,
): readonly Screen[] | null {
  const document = useSettingsDocument(
    active ? 'screens' : null,
    '화면',
    onProblem,
  );
  return useMemo(
    () => (document === null ? null : inScreenOrder(document.value.screens)),
    [document],
  );
}
