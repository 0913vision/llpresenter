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
import type {MediaItem} from '@shared/schema/mediaList';
import type {MediaId} from '@shared/schema/ids';
import {Icon} from '@renderer/ui/Icon';
import {classNames} from '@renderer/ui/classNames';
import {isComposing} from '@renderer/ui/ime';
import {layerContainer} from '@renderer/ui/layers';
import menu from '@renderer/ui/Menu.module.css';
import {useLabelPopup} from './useLabelPopup';
import styles from './SongBackground.module.css';

const VISIBLE_ROWS = 8;
const OVERSCAN = 2;

interface PickerProps {
  readonly anchor: HTMLElement;
  readonly items: readonly MediaItem[];
  readonly selected: MediaId | undefined;
  readonly onSelect: (id: MediaId | undefined) => void;
  readonly onClose: (restore: boolean) => void;
}

/** Keeps the full media list keyboard reachable while mounting a small window. */
export function MediaPicker({
  anchor,
  items,
  selected,
  onSelect,
  onClose,
}: PickerProps): JSX.Element {
  const choices = useMemo(
    () => [undefined, ...items.filter(item => item.kind !== 'audio')],
    [items],
  );
  const [active, setActive] = useState(
    Math.max(
      0,
      choices.findIndex(item => item?.id === selected),
    ),
  );
  const [top, setTop] = useState(0);
  const [row, setRow] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const id = useId();
  const {surface} = useLabelPopup({
    anchor,
    onClose,
    onEscape: () => onClose(true),
  });
  useLayoutEffect(() => {
    const element = viewport.current;
    if (element === null) return;
    const height =
      Number.parseFloat(
        getComputedStyle(element).getPropertyValue('--size-row-menu') ||
          getComputedStyle(document.documentElement).getPropertyValue(
            '--size-row-menu',
          ),
      ) || 0;
    if (height !== row) setRow(height);
    if (row > 0 && height === row && !initialized.current) {
      initialized.current = true;
      surface.current?.focus();
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
  const keyDown = (event: KeyboardEvent): void => {
    if (isComposing(event)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose(true);
      return;
    }
    const target =
      event.key === 'ArrowDown'
        ? (active + 1) % choices.length
        : event.key === 'ArrowUp'
          ? (active - 1 + choices.length) % choices.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? choices.length - 1
              : undefined;
    if (target !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      point(target);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      choose(active);
      return;
    }
    if (
      event.key.length !== 1 ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    ) {
      return;
    }
    for (let offset = 1; offset <= choices.length; offset++) {
      const index = (active + offset) % choices.length;
      if (
        (choices[index]?.name ?? '없음')
          .toLocaleLowerCase()
          .startsWith(event.key.toLocaleLowerCase())
      ) {
        event.preventDefault();
        point(index);
        return;
      }
    }
  };
  const start = Math.max(0, Math.floor(row > 0 ? top / row : 0) - OVERSCAN);
  const visible = choices.slice(start, start + VISIBLE_ROWS + OVERSCAN * 2);
  return createPortal(
    <div className={menu.layer}>
      <div
        ref={surface}
        role="listbox"
        aria-label="기본 배경"
        aria-activedescendant={
          active >= start && active < start + visible.length
            ? `${id}-${active}`
            : undefined
        }
        tabIndex={-1}
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
        <div
          ref={viewport}
          className={styles.viewport}
          style={{maxHeight: `calc(var(--size-row-menu) * ${VISIBLE_ROWS})`}}
          onScroll={event => setTop(event.currentTarget.scrollTop)}
        >
          <div style={{height: choices.length * row, position: 'relative'}}>
            {visible.map((item, offset) => {
              const index = start + offset;
              return (
                <button
                  key={item?.id ?? 'none'}
                  type="button"
                  role="option"
                  id={`${id}-${index}`}
                  tabIndex={-1}
                  aria-selected={item?.id === selected}
                  aria-posinset={index + 1}
                  aria-setsize={choices.length}
                  className={classNames(menu.item, styles.option)}
                  data-pointed={index === active}
                  style={{top: index * row}}
                  onPointerMove={() => setActive(index)}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => choose(index)}
                >
                  <span className={menu.lead}>
                    {item?.id === selected ? (
                      <Icon name="check" size={14} />
                    ) : null}
                  </span>
                  {item === undefined ? null : (
                    <Icon name={item.kind} size={14} />
                  )}
                  <span className={menu.label}>{item?.name ?? '없음'}</span>
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
