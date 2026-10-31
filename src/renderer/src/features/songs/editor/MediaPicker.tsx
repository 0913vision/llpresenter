import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {createPortal} from 'react-dom';
import type {MediaItem} from '@core/schema/mediaList';
import type {MediaId} from '@core/schema/ids';
import {mediaName} from '@renderer/features/media/backgroundChoices';
import {Icon} from '@renderer/ui/Icon';
import {classNames} from '@renderer/ui/classNames';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {useButtonPress} from '@renderer/ui/press';
import {layerContainer} from '@renderer/ui/layers';
import {MenuSearchField} from '@renderer/ui/MenuParts';
import menu from '@renderer/ui/Menu.module.css';
import {useChoicePopup} from '@renderer/ui/useChoicePopup';
import styles from './SongBackground.module.css';

const VISIBLE_ROWS = 8;
const OVERSCAN = 2;
export const NONE_LABEL = '없음';

function searchName(value: string): string {
  return value.trim().normalize('NFC').toLocaleLowerCase();
}

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
  readonly anchor: HTMLElement;
  readonly items: readonly MediaItem[];
  readonly selected: MediaId | undefined;
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly onSelect: (id: MediaId | undefined) => void;
  readonly onClose: (restore: boolean) => void;
}

/** Keeps the full media list keyboard reachable while mounting a small window. */
export function MediaPicker({
  allowNone = true,
  label = '기본 배경',
  defaultChoice,
  anchor,
  items,
  selected,
  query,
  onQueryChange,
  onSelect,
  onClose,
}: PickerProps): JSX.Element {
  const searchable = useMemo(
    () =>
      items
        .filter(item => item.kind !== 'audio')
        .map(item => ({item, name: searchName(mediaName(item))})),
    [items],
  );
  const hasDefault = allowNone || defaultChoice !== undefined;
  const choices = useMemo(() => {
    const term = searchName(query);
    return [
      ...(hasDefault ? [undefined] : []),
      ...searchable
        .filter(({name}) => name.includes(term))
        .map(({item}) => item),
    ];
  }, [searchable, query, hasDefault]);
  const [activeIndex, setActive] = useState(() =>
    searchName(query) === ''
      ? Math.max(
          0,
          choices.findIndex(item => item?.id === selected),
        )
      : Math.max(0, Math.min(hasDefault ? 1 : 0, choices.length - 1)),
  );
  const active = Math.max(0, Math.min(activeIndex, choices.length - 1));
  const [top, setTop] = useState(0);
  const [row, setRow] = useState(0);
  const [gap, setGap] = useState(0);
  const separator = useRef<HTMLDivElement>(null);
  const separated = defaultChoice !== undefined && choices.length > 1;
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
      element.scrollTop = active * row + (active > 0 ? nextGap : 0);
      setTop(element.scrollTop);
    }
  }, [active, row, surface, separated, gap]);
  const point = (index: number): void => {
    setActive(index);
    const element = viewport.current;
    if (element === null) return;
    const height = element.clientHeight || row * VISIBLE_ROWS;
    const y = index * row + (index > 0 ? gap : 0);
    if (y < element.scrollTop) element.scrollTop = y;
    else if (y + row > element.scrollTop + height) {
      element.scrollTop = y + row - height;
    }
    setTop(element.scrollTop);
  };
  const choose = (index: number): void => {
    if (choices.length === 0) return;
    onSelect(choices[index]?.id);
    onClose(true);
  };
  const optionPress = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: event => choose(Number(event.currentTarget.dataset.index)),
  });
  const filter = (value: string): void => {
    onQueryChange(value);
    const term = searchName(value);
    setActive(
      hasDefault &&
        term !== '' &&
        searchable.some(({name}) => name.includes(term))
        ? 1
        : 0,
    );
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
    hasDefault ? 1 : 0,
    Math.floor(row > 0 ? Math.max(0, top - gap) / row : 0) - OVERSCAN,
  );
  const visible = choices.slice(
    start,
    start + VISIBLE_ROWS + OVERSCAN * 2 - (hasDefault ? 1 : 0),
  );
  const activeId =
    (hasDefault && active === 0 && top < row) ||
    (active >= start && active < start + visible.length)
      ? `${id}-${active}`
      : undefined;
  const option = (index: number): JSX.Element => {
    const item = choices[index];
    const checked = item?.id === selected;
    return (
      <button
        {...optionPress}
        key={item?.id ?? 'none'}
        type="button"
        role="option"
        aria-label={
          item === undefined
            ? (defaultChoice?.label ?? NONE_LABEL)
            : mediaName(item)
        }
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
        style={{top: index * row + (index > 0 ? gap : 0)}}
        onPointerMove={() => setActive(index)}
        onMouseDown={event => event.preventDefault()}
      >
        <span className={menu.lead}>
          {checked ? <Icon name="check" size={14} /> : null}
        </span>
        {item === undefined ? null : <Icon name={item.kind} size={14} />}
        <span className={menu.label}>
          {item === undefined
            ? (defaultChoice?.label ?? NONE_LABEL)
            : mediaName(item)}
        </span>
        {item === undefined && defaultChoice !== undefined ? (
          <span className={classNames(menu.meta, styles.detail)}>
            {defaultChoice.detail}
          </span>
        ) : null}
      </button>
    );
  };
  return createPortal(
    <div className={menu.layer}>
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
            style={{height: choices.length * row + gap, position: 'relative'}}
          >
            {hasDefault ? option(0) : null}
            {separated ? (
              <div
                ref={separator}
                role="separator"
                className={classNames(menu.separator, styles.separator)}
                style={{top: row}}
              />
            ) : null}
            {visible.map((_item, offset) => option(start + offset))}
          </div>
        </div>
      </div>
    </div>,
    layerContainer('popover'),
  );
}
