import {useCallback, useState} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {UiState} from '@shared/schema/uiState';
import type {SizeClass} from './sizeClass';

// NOTE(0913vision): Spec 04 and spec 10 add 사이드바 접기 to narrow windows
// only, so only the narrow class's `leftCollapsed` is read and written.
const COLLAPSIBLE_SIZE_CLASS: SizeClass = 'narrow';

export interface SidebarCollapse {
  /** Whether the left column is collapsed now; never outside a narrow window. */
  readonly collapsed: boolean;
  /** Collapses or expands the left column; absent outside a narrow window. */
  readonly setCollapsed: ((collapsed: boolean) => void) | undefined;
}

/** A loaded choice wins the default (open); only an operator's change is saved. */
export function useSidebarCollapse(
  sizeClass: SizeClass,
  layout: UiState['layout'],
  api: Pick<LlpApi, 'ui' | 'log'> | undefined,
): SidebarCollapse {
  const [choice, setChoice] = useState(
    layout?.[COLLAPSIBLE_SIZE_CLASS]?.leftCollapsed ?? false,
  );
  const save = useCallback(
    (collapsed: boolean): void => {
      setChoice(collapsed);
      try {
        api?.ui.setLayout({
          sizeClass: COLLAPSIBLE_SIZE_CLASS,
          leftCollapsed: collapsed,
        });
      } catch (cause) {
        api?.log.write({
          level: 'error',
          message: 'Could not save the sidebar state',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
      }
    },
    [api],
  );
  const collapsible = sizeClass === COLLAPSIBLE_SIZE_CLASS;
  return {
    collapsed: collapsible && choice,
    setCollapsed: collapsible ? save : undefined,
  };
}
