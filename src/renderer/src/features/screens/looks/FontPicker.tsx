import {useMemo, useRef, useState, type JSX} from 'react';
import {createPortal} from 'react-dom';
import {FONT_CATALOG_LIMITS} from '@core/schema/fontCatalog';
import {Icon} from '@renderer/ui/Icon';
import {classNames} from '@renderer/ui/classNames';
import {layerContainer} from '@renderer/ui/layers';
import {MenuSearchField} from '@renderer/ui/MenuParts';
import {Select} from '@renderer/ui/Select';
import menu from '@renderer/ui/Menu.module.css';
import {familyChoices, type FontChoice} from './fontChoices';
import {
  FONT_PICKER_VISIBLE_ROWS,
  useFontPickerNavigation,
} from './useFontPickerNavigation';
import type {FontCatalogState} from './useFontCatalog';
import styles from './FontPicker.module.css';

interface PopupProps {
  readonly anchor: HTMLElement;
  readonly selected: string;
  readonly options: readonly FontChoice[];
  readonly onSelect: (font: string) => void;
  readonly onClose: (restore: boolean) => void;
}

function FontPopup({
  anchor,
  selected,
  options,
  onSelect,
  onClose,
}: PopupProps): JSX.Element {
  const {
    surface,
    viewport,
    id,
    choices,
    visible,
    start,
    active,
    activeId,
    row,
    query,
    filter,
    keyDown,
    choose,
    setPointed,
    setTop,
  } = useFontPickerNavigation({anchor, selected, options, onSelect, onClose});
  return createPortal(
    <div className={menu.layer}>
      <div
        ref={surface}
        className={classNames(menu.menu, styles.picker)}
        style={{
          minWidth: anchor.getBoundingClientRect().width,
          maxWidth: 'calc(100vw - var(--space-16))',
        }}
        onKeyDown={keyDown}
        onBlur={event => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          ) {
            onClose(false);
          }
        }}
      >
        <MenuSearchField
          search={{
            value: query,
            onChange: filter,
            placeholder: '글꼴 검색',
            maxLength: FONT_CATALOG_LIMITS.name,
          }}
          menuId={id}
          activeId={activeId}
        />
        <div
          ref={viewport}
          id={id}
          role="listbox"
          aria-label="글꼴"
          className={styles.viewport}
          style={{
            maxHeight: `calc(var(--size-row-menu) * ${FONT_PICKER_VISIBLE_ROWS})`,
          }}
          onScroll={event => setTop(event.currentTarget.scrollTop)}
        >
          {choices.length === 0 ? (
            <div className={styles.empty}>검색 결과 없음</div>
          ) : null}
          <div style={{height: choices.length * row, position: 'relative'}}>
            {visible.map((choice, offset) => {
              const index = start + offset;
              return (
                <button
                  key={choice.value}
                  type="button"
                  role="option"
                  id={`${id}-${index}`}
                  tabIndex={-1}
                  aria-selected={choice.value === selected}
                  aria-posinset={index + 1}
                  aria-setsize={choices.length}
                  className={classNames(menu.item, styles.option)}
                  data-pointed={index === active}
                  style={{top: index * row}}
                  onPointerMove={() => setPointed(choice.value)}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => choose(index)}
                >
                  <span className={menu.lead}>
                    {choice.value === selected ? (
                      <Icon name="check" size={14} />
                    ) : null}
                  </span>
                  <span className={menu.label}>{choice.label}</span>
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

/** Picks a bundled, installed or restored family while windowing large lists. */
export function FontPicker({
  id,
  font,
  state,
  reason,
  problem,
  onChange,
}: {
  readonly id: string;
  readonly font: string;
  readonly state: FontCatalogState;
  readonly reason: string | undefined;
  readonly problem: string | undefined;
  readonly onChange: (font: string) => void;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const closing = useRef(false);
  const {selected, options} = useMemo(
    () => familyChoices(font, state),
    [font, state],
  );
  const label =
    options.find(option => option.value === selected)?.label ?? font;
  const title = [reason, problem].filter(Boolean).join('\n') || undefined;
  const close = (restore: boolean): void => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    if (restore && anchor?.isConnected) anchor.focus();
  };
  return (
    <>
      <Select
        id={id}
        block
        ref={setAnchor}
        value={label}
        lead={
          problem === undefined ? undefined : {kind: 'icon', icon: 'warning'}
        }
        title={title}
        disabled={reason !== undefined}
        expanded={open}
        onMouseDown={event => {
          if (open) event.preventDefault();
        }}
        onExpandedChange={expanded => {
          if (expanded) {
            closing.current = false;
            setOpen(true);
          } else close(true);
        }}
      />
      {open && anchor !== null ? (
        <FontPopup
          anchor={anchor}
          selected={selected}
          options={options}
          onSelect={value => onChange(value === selected ? font : value)}
          onClose={close}
        />
      ) : null}
    </>
  );
}
