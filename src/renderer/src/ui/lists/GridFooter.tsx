import type {JSX, ReactNode} from 'react';
import {PanelFooter} from '../panels/Panel';

/** Shared footer for slide grids, with the zoom control at the right edge. */
export function GridFooter({
  count,
  children,
  actions,
  zoom,
}: {
  readonly count?: number | undefined;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
  readonly zoom?: ReactNode;
}): JSX.Element {
  return (
    <PanelFooter
      count={count}
      end={
        actions === undefined && zoom === undefined ? undefined : (
          <>
            {actions}
            {zoom}
          </>
        )
      }
    >
      {children}
    </PanelFooter>
  );
}
