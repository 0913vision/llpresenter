import type {JSX} from 'react';
import {Icon} from './Icon';
import {
  menuBlocks,
  menuItemRole,
  type MenuEntry,
  type MenuItem,
} from './menuModel';
import {titleTooltip, useTooltip} from './Tooltip';
import styles from './Menu.module.css';

const ICON_SIZE = 14;
const CHEVRON_SIZE = 12;
const SEARCH_ICON_SIZE = 16;
const SEARCH_PLACEHOLDER = '검색';

/** A search field at the top of the menu; the caller filters the entries. */
export interface MenuSearch {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string | undefined;
}

function LabelText({
  label,
  match,
}: {
  readonly label: string;
  readonly match: MenuItem['match'];
}): JSX.Element {
  if (match === undefined) return <>{label}</>;
  return (
    <>
      {label.slice(0, match.start)}
      <span className={styles.match}>
        {label.slice(match.start, match.end)}
      </span>
      {label.slice(match.end)}
    </>
  );
}

function ItemLead({item}: {readonly item: MenuItem}): JSX.Element {
  return (
    <span className={styles.lead}>
      {item.checked === true ? (
        <Icon name="check" size={ICON_SIZE} className={styles.mark} />
      ) : item.icon === undefined ? null : (
        <Icon name={item.icon} size={ICON_SIZE} />
      )}
    </span>
  );
}

export interface MenuItemRowProps {
  readonly item: MenuItem;
  readonly id: string;
  /** Draws the leading slot, empty when the item has no icon or check. */
  readonly lead: boolean;
  readonly pointed: boolean;
  /** Whether the submenu of this item is open. */
  readonly expanded: boolean;
  readonly elementRef: (element: HTMLDivElement | null) => void;
  readonly onPoint: () => void;
  readonly onRun: () => void;
}

/** One 28px item: leading slot, swatch, name, extra info, submenu arrow. */
export function MenuItemRow({
  item,
  id,
  lead,
  pointed,
  expanded,
  elementRef,
  onPoint,
  onRun,
}: MenuItemRowProps): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(item.title));
  const hasSubmenu = item.submenu !== undefined;
  return (
    <div
      {...targetProps}
      ref={elementRef}
      id={id}
      role={menuItemRole(item)}
      aria-checked={
        item.check === undefined ? undefined : item.checked === true
      }
      aria-disabled={item.disabled === true ? true : undefined}
      aria-haspopup={hasSubmenu ? 'menu' : undefined}
      aria-expanded={hasSubmenu ? expanded : undefined}
      data-pointed={pointed}
      className={styles.item}
      onPointerEnter={event => {
        targetProps.onPointerEnter(event);
        onPoint();
      }}
      onClick={onRun}
    >
      {lead ? <ItemLead item={item} /> : null}
      {item.swatch === undefined ? null : (
        <span
          className={styles.swatch}
          data-color={item.swatch}
          style={{backgroundColor: `var(--label-${item.swatch})`}}
        />
      )}
      <span className={styles.label}>
        <LabelText label={item.label} match={item.match} />
      </span>
      {item.meta === undefined ? null : (
        <span className={styles.meta}>{item.meta}</span>
      )}
      {hasSubmenu ? (
        <Icon name="right" size={CHEVRON_SIZE} className={styles.chevron} />
      ) : null}
      {tooltip}
    </div>
  );
}

/** The search field at the top of a menu; focus stays in it. */
export function MenuSearchField({
  search,
  menuId,
  activeId,
}: {
  readonly search: MenuSearch;
  readonly menuId: string;
  readonly activeId: string | undefined;
}): JSX.Element {
  const placeholder = search.placeholder ?? SEARCH_PLACEHOLDER;
  return (
    <label className={styles.search}>
      <Icon name="search" size={SEARCH_ICON_SIZE} />
      <input
        className={styles.searchInput}
        type="text"
        role="combobox"
        aria-expanded
        aria-controls={menuId}
        aria-activedescendant={activeId}
        aria-label={placeholder}
        placeholder={placeholder}
        value={search.value}
        onChange={event => search.onChange(event.target.value)}
      />
    </label>
  );
}

/** The scrolling item area: items, dividers, and named groups. */
export function MenuBlocks({
  entries,
  baseId,
  renderItem,
}: {
  readonly entries: readonly MenuEntry[];
  readonly baseId: string;
  readonly renderItem: (item: MenuItem) => JSX.Element;
}): JSX.Element {
  return (
    <div className={styles.scroll}>
      {menuBlocks(entries).map(block => {
        switch (block.kind) {
          case 'separator':
            return (
              <div
                key={block.id}
                role="separator"
                className={styles.separator}
              />
            );
          case 'group': {
            const labelId = `${baseId}-${block.id}`;
            return (
              <div key={block.id} role="group" aria-labelledby={labelId}>
                <div id={labelId} className={styles.group}>
                  {block.label}
                </div>
                {block.items.map(renderItem)}
              </div>
            );
          }
          case 'items':
            return block.items.map(renderItem);
        }
      })}
    </div>
  );
}
