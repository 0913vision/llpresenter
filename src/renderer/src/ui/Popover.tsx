import {useEffect, useState, type JSX, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {layerContainer} from './layers';

/** A floating surface returns keyboard focus to the element active on opening. */
export function Popover({
  children,
  returnTo,
}: {
  readonly children: ReactNode;
  readonly returnTo?: HTMLElement | null | undefined;
}): JSX.Element {
  const [opener] = useState(() =>
    returnTo === undefined
      ? document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      : returnTo,
  );
  useEffect(
    () => () => {
      const active = document.activeElement;
      if (
        opener?.isConnected &&
        (active === document.body || active?.isConnected !== true)
      ) {
        opener.focus({preventScroll: true});
      }
    },
    [opener],
  );
  return createPortal(children, layerContainer('popover'));
}
