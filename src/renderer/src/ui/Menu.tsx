import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import {createPortal} from 'react-dom';
import {layerContainer} from './layers';
import type {MenuCloseReason} from './menuKeys';
import {modalStack} from './modalStack';
import {markMenuTarget} from './contextMenu';
import {menuItems, type MenuEntry} from './menuModel';
import type {MenuSearch} from './MenuParts';
import {MenuSurface, type MenuSurfaceProps} from './MenuSurface';
import {placeAtPoint, placeBelow, viewportSize, type Point} from './placement';
import styles from './Menu.module.css';

export type {MenuCloseReason} from './menuKeys';
export type {MenuSearch} from './MenuParts';

/** Where a menu opens: below a button, or at the pointer (right-click). */
export type MenuAnchor = (
  | {readonly kind: 'element'; readonly element: HTMLElement}
  | {readonly kind: 'point'; readonly point: Point}
) & {readonly target?: HTMLElement | undefined};

export interface MenuProps {
  /** The menu name for assistive technology. */
  readonly label: string;
  readonly entries: readonly MenuEntry[];
  readonly anchor: MenuAnchor;
  readonly onClose: (reason: MenuCloseReason) => void;
  readonly search?: MenuSearch | undefined;
  /** A fixed width, such as 300 for the service picker. */
  readonly width?: number | undefined;
  /** The narrowest the menu may be, such as the width of a Select. */
  readonly minWidth?: number | undefined;
  readonly footer?: ReactNode | undefined;
}

function anchorPlace(anchor: MenuAnchor): MenuSurfaceProps['place'] {
  switch (anchor.kind) {
    case 'element':
      return size =>
        placeBelow(
          anchor.element.getBoundingClientRect(),
          size,
          viewportSize(),
        );
    case 'point':
      return size => placeAtPoint(anchor.point, size, viewportSize());
  }
}

/**
 * A floating menu below a button or at the pointer. It takes focus, points to
 * the first item, and gives focus back to where it was opened when it closes.
 * A click outside closes it and doesn't reach what is underneath. A menu
 * anchored in a menubar leaves the heading strip interactive.
 */
export function Menu({
  label,
  entries,
  anchor,
  onClose,
  search,
  width,
  minWidth,
  footer,
}: MenuProps): JSX.Element {
  const catcher = useRef<HTMLDivElement>(null);
  const outsideRename = useRef(false);
  const renaming = menuItems(entries).some(item => item.rename !== undefined);
  useEffect(() => {
    if (!outsideRename.current || renaming) return;
    outsideRename.current = false;
    onClose('outside');
  }, [renaming, onClose]);
  useLayoutEffect(
    () => (anchor.target ? markMenuTarget(anchor.target) : undefined),
    [anchor.target],
  );
  const [menubar] = useState(() =>
    anchor.kind === 'element'
      ? anchor.element.closest('[role="menubar"]')
      : null,
  );
  useLayoutEffect(() => {
    const element = catcher.current;
    if (menubar === null || element === null) return undefined;
    const fit = (): void => {
      element.style.top = `${menubar.getBoundingClientRect().bottom}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [menubar]);
  const [opener] = useState(() => {
    if (menubar !== null && anchor.kind === 'element') return anchor.element;
    return document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  });
  const [place] = useState(() => anchorPlace(anchor));
  const [overModal] = useState(() => modalStack.isOpen);

  useEffect(
    () => () => {
      if (opener?.isConnected === true) opener.focus();
    },
    [opener],
  );

  return createPortal(
    <div className={styles.layer} data-over-modal={overModal ? '' : undefined}>
      <div
        ref={catcher}
        className={styles.catcher}
        onPointerDown={event => {
          event.preventDefault();
          if (renaming) {
            const field =
              event.currentTarget.parentElement?.querySelector<HTMLElement>(
                '[data-renaming] input',
              );
            field?.blur();
            field?.focus();
            outsideRename.current = true;
            return;
          }
          onClose('outside');
        }}
        onContextMenu={event => event.preventDefault()}
      />
      <MenuSurface
        label={label}
        entries={entries}
        place={place}
        onClose={onClose}
        search={search}
        width={width}
        minWidth={minWidth}
        footer={footer}
        autoFocus
      />
    </div>,
    layerContainer('popover'),
  );
}
