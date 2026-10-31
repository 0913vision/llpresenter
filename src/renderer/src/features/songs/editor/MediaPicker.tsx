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
        .map(item => ({item, name: searchName(item.name)})),
    [items],
  );
  const choices = useMemo(() => {
    const term = searchName(query);
    return [
      undefined,
      ...searchable
        .filter(({name}) => name.includes(term))
        .map(({item}) => item),
    ];
  }, [searchable, query]);
  const [active, setActive] = useState(() =>
    searchName(query) === ''
      ? Math.max(
          0,
          choices.findIndex(item => item?.id === selected),
        )
      : Math.min(1, choices.length - 1),
  );
  const [top, setTop] = useState(0);
  const [row, setRow] = useState(0);
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
    if (row > 0 && height === row && !initialized.current) {
      initialized.current = true;
      surface.current?.querySelector('input')?.focus();
      element.scrollTop = active * row;
      setTop(element.scrollTop);
    }
  }, [active, row, surface]);
  const point = (index: number): void => {
    setActive(index);
    const element = viewport.current;
    if (element === null) return;
    const height = element.clientHeight || row * VISIBLE_ROWS;
    if (index * row < element.scrollTop) element.scrollTop = index * row;
    else if ((index + 1) * row > element.scrollTop + height) {
      element.scrollTop = (index + 1) * row - height;
    }
    setTop(element.scrollTop);
  };
  const choose = (index: number): void => {
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
      term !== '' && searchable.some(({name}) => name.includes(term)) ? 1 : 0,
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
  const start = Math.max(0, Math.floor(row > 0 ? top / row : 0) - OVERSCAN);
  const visible = choices.slice(start, start + VISIBLE_ROWS + OVERSCAN * 2);
  const activeId =
    active >= start && active < start + visible.length
      ? `${id}-${active}`
      : undefined;
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
          aria-label="기본 배경"
          className={styles.viewport}
          style={{maxHeight: `calc(var(--size-row-menu) * ${VISIBLE_ROWS})`}}
          onScroll={event => setTop(event.currentTarget.scrollTop)}
        >
          <div style={{height: choices.length * row, position: 'relative'}}>
            {visible.map((item, offset) => {
              const index = start + offset;
              return (
                <button
                  {...optionPress}
                  key={item?.id ?? 'none'}
                  type="button"
                  role="option"
                  id={`${id}-${index}`}
                  tabIndex={-1}
                  aria-selected={item?.id === selected}
                  aria-posinset={index + 1}
                  aria-setsize={choices.length}
                  className={classNames(menu.item, styles.option)}
                  data-index={index}
                  style={{top: index * row}}
                  onPointerMove={() => setActive(index)}
                  onMouseDown={event => event.preventDefault()}
                >
                  <span className={menu.lead}>
                    {item?.id === selected ? (
                      <Icon name="check" size={14} />
                    ) : null}
                  </span>
                  {item === undefined ? null : (
                    <Icon name={item.kind} size={14} />
                  )}
                  <span className={menu.label}>{item?.name ?? NONE_LABEL}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    layerContainer('popover'),
  );
}
