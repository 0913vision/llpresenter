import {useId, useState, type JSX, type KeyboardEvent} from 'react';
import {
  choiceLabel,
  isChosenChoice,
  pickerChoices,
  searchName,
  type MediaPickerItem,
  type PickerChoice,
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
import {usePickerViewport, VISIBLE_ROWS} from './usePickerViewport';
import styles from './MediaPicker.module.css';
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

/** One row of the picker: a check when chosen, the kind of media, and its name. */
function PickerOption({
  item,
  index,
  count,
  id,
  name,
  checked,
  detail,
  top,
  press,
  onPoint,
}: {
  readonly item: PickerChoice;
  readonly index: number;
  readonly count: number;
  readonly id: string;
  readonly name: string;
  readonly checked: boolean;
  /** What the default choice stands for, shown after its name. */
  readonly detail: string | undefined;
  readonly top: number;
  readonly press: ReturnType<typeof useButtonPress<HTMLButtonElement>>;
  readonly onPoint: () => void;
}): JSX.Element {
  return (
    <button
      {...press}
      type="button"
      role="option"
      aria-label={name}
      aria-description={detail}
      id={id}
      tabIndex={-1}
      aria-selected={checked}
      aria-posinset={index + 1}
      aria-setsize={count}
      className={classNames(menu.item, styles.option)}
      data-index={index}
      style={{top}}
      onPointerMove={onPoint}
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
      {detail === undefined ? null : (
        <span className={classNames(menu.meta, styles.detail)}>{detail}</span>
      )}
    </button>
  );
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
  const separated =
    defaultChoice !== undefined && choices.length > specialCount;
  const id = useId();
  const {surface} = useChoicePopup({
    anchor,
    onClose,
    onEscape: () => onClose(true),
    activeId: `${id}-${active}`,
  });
  const {
    viewport,
    separator,
    row,
    gap,
    rowTop,
    reveal,
    toTop,
    onScroll,
    start,
    end,
    shows,
  } = usePickerViewport({
    surface,
    active,
    count: choices.length,
    specialCount,
    groups,
    separated,
  });
  const point = (index: number): void => {
    setActive(index);
    reveal(index);
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
    toTop();
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
  const activeId = shows(active) ? `${id}-${active}` : undefined;
  const option = (index: number): JSX.Element => {
    const item = choices[index];
    return (
      <PickerOption
        key={item === null ? 'explicit-none' : (item?.id ?? 'default')}
        item={item}
        index={index}
        count={choices.length}
        id={`${id}-${index}`}
        name={choiceLabel(item, specials)}
        checked={isChosenChoice(item, selected, specials)}
        detail={item === undefined ? defaultChoice?.detail : undefined}
        top={rowTop(index)}
        press={optionPress}
        onPoint={() => setActive(index)}
      />
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
            onScroll={event => onScroll(event.currentTarget.scrollTop)}
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
              {Array.from({length: Math.max(0, end - start)}, (_, offset) =>
                option(start + offset),
              )}
            </div>
          </div>
        </div>
      </div>
    </Popover>
  );
}
