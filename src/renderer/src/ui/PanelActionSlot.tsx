import {createContext, useContext, type JSX, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {PanelActions} from './Panel';

/**
 * The place in a panel's title row that its current tab fills. Undefined
 * outside such a panel; null until the place is in the page.
 */
const Slot = createContext<HTMLElement | null | undefined>(undefined);

/** The right end of a panel's title row, for the commands of its tab. */
export function PanelActionTarget({
  onPlace,
}: {
  /** Takes the element the commands go into, or null when it leaves. */
  readonly onPlace: (place: HTMLElement | null) => void;
}): JSX.Element {
  return (
    <PanelActions>
      <span ref={onPlace} style={{display: 'contents'}} />
    </PanelActions>
  );
}

/** Lets the tabs inside put their commands into `place`. */
export function PanelActionScope({
  place,
  children,
}: {
  readonly place: HTMLElement | null;
  readonly children: ReactNode;
}): JSX.Element {
  return <Slot value={place}>{children}</Slot>;
}

/**
 * A command of a tab, such as its 추가 button, shown at the right end of
 * the panel's title row; in place when the tab is shown on its own.
 */
export function PanelAction({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element | null {
  const place = useContext(Slot);
  if (place === undefined) return <>{children}</>;
  return place === null ? null : createPortal(children, place);
}
