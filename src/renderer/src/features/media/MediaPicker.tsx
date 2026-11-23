import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {
  choiceLabel,
  isChosenChoice,
  pickerChoices,
  searchName,
  type MediaPickerItem,
} from './mediaPickerChoices';
import {Icon} from '@renderer/ui/Icon';
import {classNames} from '@renderer/ui/classNames';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {useButtonPress} from '@renderer/ui/press';
import {Popover} from '@renderer/ui/Popover';
import {modalStack} from '@renderer/ui/modalStack';
import {MenuSearchField} from '@renderer/ui/MenuParts';
import menu from '@renderer/ui/Menu.module.css';
import {useChoicePopup} from '@renderer/ui/useChoicePopup';
import styles from './MediaPicker.module.css';

const VISIBLE_ROWS = 8;
const OVERSCAN = 2;
export {NONE_LABEL, type MediaPickerItem} from './mediaPickerChoices';

function targetFor(
  key: string,
  active: number,
  count: number,
): number | undefined {
  if (count === 0) return undefined;
  switch (key) {
    case 'ArrowDown':
      return (active + 1) % count;
    case 'ArrowUp':
      return (active - 1 + count) % count;
    default:
      return undefined;
  }
}

interface PickerProps {
  readonly allowNone?: boolean;
  readonly label?: string;
  readonly defaultChoice?: {readonly label: string; readonly detail: string};
  readonly explicitNone?: {
    readonly selected: boolean;
    readonly onSelect: () => void;
  };
  readonly anchor: HTMLElement;
  readonly items: readonly MediaPickerItem[];
  readonly leadingGroup?: {
    readonly label: string;
    readonly items: readonly MediaPickerItem[];
  };
  readonly itemsLabel?: string;
  readonly selected: string | undefined;
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly onSelect: (id: string | undefined) => void;
  readonly onClose: (restore: boolean) => void;
}

/** Keeps the full media list keyboard reachable while mounting a small window. */
export function MediaPicker({
  allowNone = true,
  label = '기본 배경',
  defaultChoice,
  explicitNone,
  anchor,
  items,
  leadingGroup,
  itemsLabel,
  selected,
  query,
  onQueryChange,
  onSelect,
  onClose,
}: PickerProps): JSX.Element {
  const [overModal] = useState(() => modalStack.isOpen);
  const specials = {allowNone, defaultChoice, explicitNone};
  const pick = (value: string) =>
    pickerChoices({items, leadingGroup, itemsLabel, query: value, specials});
  const {choices, groups, specialCount, hasDefault} = pick(query);
  const [activeIndex, setActive] = useState(() =>
    searchName(query) === ''
      ? Math.max(
          0,
          choices.findIndex(item => isChosenChoice(item, selected, specials)),
        )
      : Math.max(0, Math.min(specialCount, choices.length - 1)),
  );
  const active = Math.max(0, Math.min(activeIndex, choices.length - 1));
  const [top, setTop] = useState(0);
  const [row, setRow] = useState(0);
  const [gap, setGap] = useState(0);
  const groupOffset = (index: number): number =>
    groups.filter(group => group.index <= index).length * row;
  const separator = useRef<HTMLDivElement>(null);
  const separated =
    defaultChoice !== undefined && choices.length > specialCount;
  const viewport = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const id = useId();
  const {surface} = useChoicePopup({
    anchor,
    onClose,
    onEscape: () => onClose(true),
    activeId: `${id}-${active}`,
  });
  useLayoutEffect(() => {
    const element = viewport.current;
    if (element === null) return;
    const height =
      Number.parseFloat(
        getComputedStyle(element).getPropertyValue('--size-row-menu'),
      ) || 0;
    if (height !== row) setRow(height);
    const divider = separator.current;
    const style = divider === null ? null : getComputedStyle(divider);
    const nextGap =
      divider === null || style === null
        ? 0
        : divider.getBoundingClientRect().height +
          (Number.parseFloat(style.marginTop) || 0) +
          (Number.parseFloat(style.marginBottom) || 0);
    if (nextGap !== gap) setGap(nextGap);
    if (row > 0 && height === row && !initialized.current) {
      initialized.current = true;
      surface.current?.querySelector('input')?.focus();
      element.scrollTop =
        active === 0
          ? 0
          : active * row +
            (active >= specialCount ? nextGap : 0) +
            groups.filter(group => group.index <= active).length * row;
      setTop(element.scrollTop);
    }
  }, [active, row, surface, separated, gap, groups, specialCount]);
  const point = (index: number): void => {
    setActive(index);
    const element = viewport.current;
    if (element === null) return;
    const height = element.clientHeight || row * VISIBLE_ROWS;
    const y =
      index * row + (index >= specialCount ? gap : 0) + groupOffset(index);
    if (index === 0) element.scrollTop = 0;
    else if (y < element.scrollTop) element.scrollTop = y;
    else if (y + row > element.scrollTop + height) {
      element.scrollTop = y + row - height;
    }
    setTop(element.scrollTop);
  };
  const choose = (index: number): void => {
    if (choices.length === 0) return;
    if (choices[index] === null) explicitNone?.onSelect();
    else onSelect(choices[index]?.id);
    onClose(true);
  };
  const optionPress = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: event => choose(Number(event.currentTarget.dataset.index)),
  });
  const filter = (value: string): void => {
    onQueryChange(value);
    setActive(hasDefault && pick(value).found ? specialCount : 0);
    if (viewport.current !== null) viewport.current.scrollTop = 0;
    setTop(0);
  };
  const keyDown = (event: KeyboardEvent): void => {
    if (isComposing(event) || hasModifier(event)) return;
    const inField = event.target instanceof HTMLInputElement;
    if (inField && ['Home', 'End', ' '].includes(event.key)) return;
    const target = targetFor(event.key, active, choices.length);
    if (target !== undefined) {
      point(target);
    } else if (event.key === 'Enter' || event.key === ' ') {
      choose(active);
    } else if (event.key === 'Escape') onClose(true);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
  const start = Math.max(
    specialCount,
    Math.floor(row > 0 ? Math.max(0, top - gap) / row : 0) -
      groups.length -
      OVERSCAN,
  );
  const visible = choices.slice(
    start,
    start + VISIBLE_ROWS + OVERSCAN * 2 - specialCount,
  );
  const activeId =
    (active < specialCount &&
      active * row >= top &&
      active * row < top + row * VISIBLE_ROWS) ||
    (active >= start && active < start + visible.length)
      ? `${id}-${active}`
      : undefined;
  const option = (index: number): JSX.Element => {
    const item = choices[index];
    const checked = isChosenChoice(item, selected, specials);
    const name = choiceLabel(item, specials);
    return (
      <button
        {...optionPress}
        key={item === null ? 'explicit-none' : (item?.id ?? 'default')}
        type="button"
        role="option"
        aria-label={name}
        aria-description={
          item === undefined ? defaultChoice?.detail : undefined
        }
        id={`${id}-${index}`}
        tabIndex={-1}
        aria-selected={checked}
        aria-posinset={index + 1}
        aria-setsize={choices.length}
        className={classNames(menu.item, styles.option)}
        data-index={index}
        style={{
          top:
            index * row +
            (index >= specialCount ? gap : 0) +
            groupOffset(index),
        }}
        onPointerMove={() => setActive(index)}
        onMouseDown={event => event.preventDefault()}
      >
        <span className={menu.lead}>
          {checked ? <Icon name="check" size={14} /> : null}
        </span>
        {item == null ? null : item.kind === 'fill' ? (
          <span className={styles.paint} style={{background: item.paint}} />
        ) : (
          <Icon name={item.kind === 'video' ? 'film' : item.kind} size={14} />
        )}
        <span className={menu.label}>{name}</span>
        {item === undefined && defaultChoice !== undefined ? (
          <span className={classNames(menu.meta, styles.detail)}>
            {defaultChoice.detail}
          </span>
        ) : null}
      </button>
    );
  };
  return (
    <Popover>
      <div className={menu.layer} data-over-modal={overModal ? '' : undefined}>
        <div
          ref={surface}
          className={classNames(menu.menu, styles.picker)}
          onKeyDown={keyDown}
          onBlur={event => {
            if (
              event.relatedTarget instanceof Node &&
              !event.currentTarget.contains(event.relatedTarget)
            ) {
              onClose(false);
            }
          }}
        >
          <MenuSearchField
            search={{value: query, onChange: filter}}
            menuId={id}
            activeId={activeId}
          />
          <div
            ref={viewport}
            id={id}
            role="listbox"
            aria-label={label}
            className={styles.viewport}
            style={{maxHeight: `calc(var(--size-row-menu) * ${VISIBLE_ROWS})`}}
            onScroll={event => setTop(event.currentTarget.scrollTop)}
          >
            <div
              style={{
                height: (choices.length + groups.length) * row + gap,
                position: 'relative',
              }}
            >
              {groups.map((group, index) => (
                <div
                  key={group.label}
                  className={classNames(menu.group, styles.group)}
                  style={{
                    top:
                      (group.index + index) * row + (group.index > 0 ? gap : 0),
                    height: row,
                  }}
                >
                  {group.label}
                </div>
              ))}
              {Array.from({length: specialCount}, (_, index) => option(index))}
              {separated ? (
                <div
                  ref={separator}
                  role="separator"
                  className={classNames(menu.separator, styles.separator)}
                  style={{top: specialCount * row}}
                />
              ) : null}
              {visible.map((_item, offset) => option(start + offset))}
            </div>
          </div>
        </div>
      </div>
    </Popover>
  );
}
