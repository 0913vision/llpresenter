import {useRef, type JSX} from 'react';
import {Icon} from './Icon';
import {
  hasIconColumn,
  hasSubmenu as hasMenuSubmenu,
  menuBlocks,
  menuItemRole,
  type MenuEntry,
  type MenuItem,
} from './menuModel';
import {titleTooltip, useTooltip} from './Tooltip';
import styles from './Menu.module.css';
import {useInputCompletion, type InputCompletion} from './useInputCompletion';
import {useFieldReason} from './fieldFrame';
import {NameField} from './ListRow';

const ICON_SIZE = 18;
const CHECK_SIZE = 16;
const CHEVRON_SIZE = 16;
const SEARCH_ICON_SIZE = 16;
const SEARCH_PLACEHOLDER = '검색';

/** A search field at the top of the menu; the caller filters the entries. */
export interface MenuSearch {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string | undefined;
  readonly invalidReason?: string | undefined;
  readonly maxLength?: number | undefined;
  readonly complete?:
    | ((
        start: number,
        end: number,
        pointedId: string | undefined,
      ) => InputCompletion | null)
    | undefined;
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

/** The check mark in the left padding of a current or turned-on item. */
export function MenuCheck(): JSX.Element {
  return (
    <span className={styles.lead}>
      <Icon name="check" size={CHECK_SIZE} />
    </span>
  );
}

export interface MenuItemRowProps {
  readonly item: MenuItem;
  readonly id: string;
  /** Draws the icon column, empty when this item has no icon. */
  readonly iconColumn: boolean;
  readonly pointed: boolean;
  /** Whether the submenu of this item is open. */
  readonly expanded: boolean;
  readonly elementRef: (element: HTMLDivElement | null) => void;
  readonly onPoint: () => void;
  readonly onRun: () => void;
}

/**
 * One 28px item: check mark in the left padding, icon column, swatch, name,
 * extra info, submenu arrow.
 */
export function MenuItemRow({
  item,
  id,
  iconColumn,
  pointed,
  expanded,
  elementRef,
  onPoint,
  onRun,
}: MenuItemRowProps): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(item.title));
  const row = useRef<HTMLDivElement>(null);
  const finishRename = (name?: string): void => {
    if (name === undefined) item.rename?.onCancel();
    else item.rename?.onCommit(name);
    const menu = row.current?.closest<HTMLElement>('[role="menu"]');
    (menu?.querySelector<HTMLElement>('[role="combobox"]') ?? menu)?.focus();
  };
  const hasSubmenu = hasMenuSubmenu(item);
  return (
    <div
      {...targetProps}
      ref={element => {
        row.current = element;
        elementRef(element);
      }}
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
      onClick={item.rename === undefined ? onRun : undefined}
      onContextMenu={event => {
        if (item.onMenu === undefined || item.rename !== undefined) return;
        event.preventDefault();
        event.stopPropagation();
        item.onMenu({
          kind: 'point',
          point: {x: event.clientX, y: event.clientY},
        });
      }}
    >
      {item.checked === true ? <MenuCheck /> : null}
      {iconColumn ? (
        <span className={styles.icon}>
          {item.icon === undefined ? null : (
            <Icon name={item.icon} size={ICON_SIZE} />
          )}
        </span>
      ) : null}
      {item.preview === undefined ? null : (
        <span aria-hidden="true" className={styles.preview}>
          {item.preview}
        </span>
      )}
      {item.swatch === undefined ? null : (
        <span
          className={styles.swatch}
          data-color={item.swatch}
          style={{backgroundColor: `var(--label-${item.swatch})`}}
        />
      )}
      <span className={styles.label}>
        {item.rename === undefined ? (
          <LabelText label={item.label} match={item.match} />
        ) : (
          <NameField
            label={item.label}
            rename={{
              ...item.rename,
              onCommit: finishRename,
              onCancel: () => finishRename(),
            }}
          />
        )}
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
  pointedId,
}: {
  readonly search: MenuSearch;
  readonly menuId: string;
  readonly activeId: string | undefined;
  readonly pointedId?: string | undefined;
}): JSX.Element {
  const placeholder = search.placeholder ?? SEARCH_PLACEHOLDER;
  const complete = useInputCompletion(search.onChange);
  const reason = useFieldReason({
    invalid: search.invalidReason !== undefined,
    reason: search.invalidReason,
    describedBy: undefined,
    title: undefined,
  });
  const {targetProps, tooltip} = useTooltip(titleTooltip(reason.tooltip));
  return (
    <>
      <label
        {...targetProps}
        className={styles.search}
        data-invalid={search.invalidReason ? true : undefined}
      >
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
          maxLength={search.maxLength}
          aria-invalid={search.invalidReason ? true : undefined}
          aria-describedby={reason.describedBy}
          onChange={event => search.onChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Tab') {
              complete(
                event,
                search.complete?.(
                  event.currentTarget.selectionStart ?? search.value.length,
                  event.currentTarget.selectionEnd ?? search.value.length,
                  pointedId,
                ) ?? null,
              );
            }
          }}
        />
      </label>
      {reason.element}
      {tooltip}
    </>
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
  readonly renderItem: (item: MenuItem, iconColumn: boolean) => JSX.Element;
}): JSX.Element {
  const render = (items: readonly MenuItem[]): JSX.Element[] => {
    const iconColumn = hasIconColumn(items);
    return items.map(item => renderItem(item, iconColumn));
  };
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
                {render(block.items)}
              </div>
            );
          }
          case 'items':
            return render(block.items);
        }
      })}
    </div>
  );
}
