import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import {Popover} from '../popups/Popover';
import type {MenuCloseReason} from './menuKeys';
import {modalStack} from '../popups/modalStack';
import {markMenuTarget, passContextMenu} from './contextMenu';
import {menuItems, type MenuEntry, type MenuAnchor} from './menuModel';
import type {MenuSearch} from './MenuParts';
import {MenuSurface, type MenuSurfaceProps} from './MenuSurface';
import {placeAtPoint, placeBelow, viewportSize} from '../popups/placement';
import styles from './Menu.module.css';
import {contextMenuEntries} from './contextMenuEntries';

export interface MenuProps {
  readonly context?: boolean;
  /** The menu name for assistive technology. */
  readonly label: string;
  readonly entries: readonly MenuEntry[];
  readonly anchor: MenuAnchor;
  readonly onClose: (reason: MenuCloseReason) => void;
  readonly search?: MenuSearch | undefined;
  /** A fixed width in pixels or a design token, such as `var(--size-menu-max)`. */
  readonly width?: number | string | undefined;
  /** The narrowest the menu may be, such as the width of a Select. */
  readonly minWidth?: number | undefined;
  readonly footer?: ReactNode | undefined;
  /** Keep focus in an editable trigger until the pointer enters the list. */
  readonly autoFocus?: boolean | undefined;
  /** The element to restore when the menu closes, if different from its anchor. */
  readonly returnTo?: HTMLElement | null | undefined;
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
  entries: suppliedEntries,
  context = false,
  anchor,
  onClose,
  search,
  width,
  minWidth,
  footer,
  autoFocus = true,
  returnTo,
}: MenuProps): JSX.Element {
  const entries = context
    ? contextMenuEntries(suppliedEntries)
    : suppliedEntries;
  const catcher = useRef<HTMLDivElement>(null);
  const closingFromAnchor = useRef(false);
  const outsideRename = useRef(false);
  const renaming = menuItems(entries).some(item => item.rename !== undefined);
  useEffect(() => {
    if (!outsideRename.current || renaming) return;
    outsideRename.current = false;
    onClose('outside');
  }, [renaming, onClose]);
  useLayoutEffect(() => {
    const targets = anchor.targets ?? (anchor.target ? [anchor.target] : []);
    const releases = targets.map(markMenuTarget);
    return () => releases.forEach(release => release());
  }, [anchor.target, anchor.targets]);
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
    if (returnTo !== undefined) return returnTo;
    if (menubar !== null && anchor.kind === 'element') return anchor.element;
    return document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  });
  const [place] = useState(() => anchorPlace(anchor));
  const [overModal] = useState(() => modalStack.isOpen);
  const close = (reason: MenuCloseReason): void => {
    if (reason === 'escape' && menubar !== null && anchor.kind === 'element') {
      anchor.element.focus({preventScroll: true});
    }
    onClose(reason);
  };

  return (
    <Popover returnTo={opener}>
      <div
        className={styles.layer}
        data-over-modal={overModal ? '' : undefined}
      >
        <div
          ref={catcher}
          className={styles.catcher}
          onPointerDown={event => {
            event.preventDefault();
            // NOTE(0913vision): A right-click outside closes the menu at once;
            // the click itself goes on to what is under the pointer.
            if (event.button === 2 && !renaming) {
              onClose('outside');
              return;
            }
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
            if (menubar === null && anchor.kind === 'element') {
              const bounds = anchor.element.getBoundingClientRect();
              if (
                bounds.width > 0 &&
                bounds.height > 0 &&
                event.clientX >= bounds.left &&
                event.clientX <= bounds.right &&
                event.clientY >= bounds.top &&
                event.clientY <= bounds.bottom
              ) {
                closingFromAnchor.current = true;
                return;
              }
            }
            onClose('outside');
          }}
          onClick={event => {
            if (!closingFromAnchor.current) return;
            event.preventDefault();
            event.stopPropagation();
            closingFromAnchor.current = false;
            onClose('outside');
          }}
          onContextMenu={event => {
            event.preventDefault();
            if (!renaming) {
              passContextMenu(
                event.nativeEvent,
                event.currentTarget.parentElement,
              );
            }
          }}
        />
        <MenuSurface
          label={label}
          entries={entries}
          place={place}
          onClose={close}
          search={search}
          width={width}
          minWidth={minWidth}
          footer={footer}
          autoFocus={autoFocus}
        />
      </div>
    </Popover>
  );
}
