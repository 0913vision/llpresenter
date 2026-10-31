import {
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode,
  type MouseEvent,
  type RefObject,
} from 'react';
import {placeFloating} from './floating';
import {lastInputWasKeyboard} from './inputModality';
import {openItemMenu, type MenuCloseReason} from './menuKeys';
import {
  isRunnable,
  hasCheckColumn,
  type MenuEntry,
  type MenuItem,
} from './menuModel';
import {
  MenuBlocks,
  MenuItemRow,
  MenuSearchField,
  type MenuSearch,
} from './MenuParts';
import {
  maxPopoverHeight,
  menuChainShift,
  placeSubmenu,
  viewportSize,
  type Point,
  type Size,
} from './placement';
import {
  focusMenu,
  useMenuNavigation,
  type MenuNavigation,
} from './useMenuNavigation';
import styles from './Menu.module.css';

/** The contents, placement, and parent chain of one menu surface. */
export interface MenuSurfaceProps {
  readonly label: string;
  readonly entries: readonly MenuEntry[];
  readonly place: (size: Size) => Point;
  readonly onClose: (reason: MenuCloseReason) => void;
  readonly onBack?: (() => void) | undefined;
  readonly onPointerEnter?: (() => void) | undefined;
  readonly search?: MenuSearch | undefined;
  readonly width?: number | undefined;
  readonly minWidth?: number | undefined;
  readonly autoFocus: boolean;
  readonly footer?: ReactNode | undefined;
  readonly ancestors?: ReadonlyArray<RefObject<HTMLDivElement | null>>;
}

/** Draws and fits a menu surface and its recursively opened submenus. */
export function MenuSurface(props: MenuSurfaceProps): JSX.Element {
  const {label, entries, place, onClose, onBack, search, autoFocus} = props;
  const baseId = useId();
  const surface = useRef<HTMLDivElement>(null);
  const blockedPointer = useRef(false);
  const [openedByKeyboard] = useState(lastInputWasKeyboard);
  const nav = useMenuNavigation({
    entries,
    searchValue: search?.value,
    surface,
    onClose,
    onBack,
    pointsFirst: autoFocus && (openedByKeyboard || search !== undefined),
  });
  const itemId = (index: number): string => `${baseId}-item-${index}`;
  const activeId = nav.pointed >= 0 ? itemId(nav.pointed) : undefined;

  useEffect(() => {
    if (autoFocus) focusMenu(surface.current);
  }, [autoFocus]);

  const fit = (element: HTMLElement): void => {
    element.style.maxHeight = `${maxPopoverHeight(viewportSize())}px`;
    placeFloating(element, place);
    if (!props.ancestors?.length) return;
    const chain = [
      ...(props.ancestors ?? []).flatMap(ref =>
        ref.current ? [ref.current] : [],
      ),
      element,
    ];
    const boxes = chain.map(menu => menu.getBoundingClientRect());
    const shift = menuChainShift(boxes, viewportSize());
    if (shift !== 0) {
      chain.forEach((menu, index) => {
        const box = boxes[index];
        if (box) {
          menu.style.left = `${box.left + shift}px`;
        }
      });
    }
  };
  const refit = useEffectEvent(() => {
    if (surface.current !== null) fit(surface.current);
  });
  useEffect(() => {
    window.addEventListener('resize', refit);
    return () => window.removeEventListener('resize', refit);
  }, []);

  const renderItem = (item: MenuItem, iconColumn: boolean): JSX.Element => {
    const index = nav.items.indexOf(item);
    return (
      <MenuItemRow
        key={item.id}
        item={
          nav.renaming && item.rename === undefined
            ? {...item, disabled: true, title: '이름 편집 중'}
            : item
        }
        id={itemId(index)}
        iconColumn={iconColumn}
        pointed={!nav.renaming && index === nav.pointed}
        expanded={nav.submenu?.index === index}
        elementRef={element => {
          nav.itemElements.current[index] = element;
        }}
        onPoint={() => nav.hover(index)}
        onLeave={nav.leave}
        onRun={() => nav.run(index)}
      />
    );
  };
  const style: CSSProperties = {width: props.width, minWidth: props.minWidth};
  const isRenameTarget = (target: EventTarget): boolean =>
    target instanceof Element && target.closest('[data-renaming]') !== null;
  const commitRename = (): void => {
    const field = surface.current?.querySelector<HTMLElement>(
      '[data-renaming] input',
    );
    field?.blur();
    field?.focus();
  };
  const consumeClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (
      !blockedPointer.current &&
      (!nav.renaming || isRenameTarget(event.target))
    ) {
      return;
    }
    blockedPointer.current = false;
    event.preventDefault();
    event.stopPropagation();
    if (nav.renaming) commitRename();
  };

  return (
    <>
      <div
        ref={element => {
          surface.current = element;
          if (element !== null) fit(element);
        }}
        id={baseId}
        role="menu"
        aria-label={label}
        aria-activedescendant={search === undefined ? activeId : undefined}
        tabIndex={-1}
        className={styles.menu}
        data-check-column={hasCheckColumn(entries) ? 'true' : 'false'}
        style={style}
        onPointerDownCapture={event => {
          blockedPointer.current = false;
          if (!nav.renaming || isRenameTarget(event.target)) return;
          blockedPointer.current = true;
          event.preventDefault();
          event.stopPropagation();
          commitRename();
        }}
        onClickCapture={consumeClick}
        onContextMenuCapture={consumeClick}
        onKeyDown={event => {
          if (nav.renaming) return;
          if (
            openItemMenu(
              event,
              nav.items[nav.pointed],
              nav.itemElements.current[nav.pointed],
            )
          ) {
            event.preventDefault();
            event.stopPropagation();
          } else {
            nav.onKeyDown(event);
          }
        }}
        onPointerEnter={() => {
          focusMenu(surface.current);
          props.onPointerEnter?.();
        }}
        onPointerLeave={nav.leave}
        onPointerMove={event => {
          if (
            event.target instanceof Element &&
            !event.target.closest('[role^="menuitem"]')
          ) {
            nav.leave();
          }
        }}
      >
        {search === undefined ? null : (
          <MenuSearchField
            search={search}
            menuId={baseId}
            activeId={activeId}
            pointedId={nav.items[nav.pointed]?.id}
          />
        )}
        <MenuBlocks entries={entries} baseId={baseId} renderItem={renderItem} />
        {props.footer}
      </div>
      <Submenu
        nav={nav}
        parent={surface}
        ancestors={props.ancestors ?? []}
        onClose={onClose}
      />
    </>
  );
}

function Submenu({
  nav,
  parent,
  ancestors,
  onClose,
}: {
  readonly nav: MenuNavigation;
  readonly parent: RefObject<HTMLDivElement | null>;
  readonly ancestors: ReadonlyArray<RefObject<HTMLDivElement | null>>;
  readonly onClose: (reason: MenuCloseReason) => void;
}): JSX.Element | null {
  const {submenu} = nav;
  const item = submenu === null ? undefined : nav.items[submenu.index];
  const entries = useMemo(
    () =>
      isRunnable(item) ? (item.submenu ?? item.loadSubmenu?.()) : undefined,
    [item],
  );
  if (submenu === null) return null;
  const element = nav.itemElements.current[submenu.index];
  if (
    item === undefined ||
    entries === undefined ||
    element === null ||
    element === undefined
  ) {
    return null;
  }
  const place = (size: Size): Point => {
    const itemBox = element.getBoundingClientRect();
    const menuBox = parent.current?.getBoundingClientRect() ?? itemBox;
    const boxes = ancestors.flatMap(ref =>
      ref.current ? [ref.current.getBoundingClientRect()] : [],
    );
    return placeSubmenu(
      {item: itemBox, menu: menuBox, ancestors: boxes},
      size,
      viewportSize(),
    );
  };
  return (
    <MenuSurface
      label={item.label}
      entries={entries}
      place={place}
      onClose={onClose}
      onBack={nav.closeSubmenu}
      onPointerEnter={nav.keepSubmenuOpen}
      autoFocus={submenu.takesFocus}
      ancestors={[...ancestors, parent]}
    />
  );
}
