import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {isComposing} from '@renderer/ui/ime';
import {useChoicePopup} from '@renderer/ui/useChoicePopup';
import {filterFamilies, type FontChoice} from './fontChoices';

export const FONT_PICKER_VISIBLE_ROWS = 8;
const OVERSCAN = 2;
const DEFAULT_ROW_PX = 28;

interface NavigationOptions {
  readonly anchor: HTMLElement;
  readonly selected: string;
  readonly options: readonly FontChoice[];
  readonly onSelect: (font: string) => void;
  readonly onClose: (restore: boolean) => void;
}

/** Maintains keyboard navigation and a bounded window into installed families. */
export function useFontPickerNavigation({
  anchor,
  selected,
  options,
  onSelect,
  onClose,
}: NavigationOptions) {
  const [query, setQuery] = useState('');
  const choices = useMemo(
    () => filterFamilies(options, query),
    [options, query],
  );
  const [pointed, setPointed] = useState(selected);
  const pointedIndex = choices.findIndex(choice => choice.value === pointed);
  const selectedIndex = choices.findIndex(choice => choice.value === selected);
  const active = pointedIndex >= 0 ? pointedIndex : Math.max(0, selectedIndex);
  const [top, setTop] = useState(0);
  const [row, setRow] = useState(DEFAULT_ROW_PX);
  const viewport = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const lastOptions = useRef(options);
  const id = useId();
  const {surface} = useChoicePopup({
    anchor,
    onClose,
    onEscape: () => onClose(true),
  });
  useLayoutEffect(() => {
    const element = viewport.current;
    if (element === null) return;
    const height =
      Number.parseFloat(
        getComputedStyle(element).getPropertyValue('--size-row-menu'),
      ) || DEFAULT_ROW_PX;
    if (height !== row) setRow(height);
    if (height === row && !initialized.current) {
      initialized.current = true;
      surface.current?.querySelector<HTMLInputElement>('input')?.focus();
      element.scrollTop = active * row;
      setTop(element.scrollTop);
    }
  }, [active, row, surface]);
  useLayoutEffect(() => {
    if (lastOptions.current === options) return;
    lastOptions.current = options;
    const element = viewport.current;
    if (!initialized.current || element === null || choices.length === 0) {
      return;
    }
    const height = element.clientHeight || row * FONT_PICKER_VISIBLE_ROWS;
    if (active * row < element.scrollTop) element.scrollTop = active * row;
    else if ((active + 1) * row > element.scrollTop + height) {
      element.scrollTop = (active + 1) * row - height;
    }
    setTop(element.scrollTop);
  }, [active, choices.length, options, row]);
  const point = (index: number): void => {
    const choice = choices[index];
    if (choice === undefined) return;
    setPointed(choice.value);
    const element = viewport.current;
    if (element === null) return;
    const height = element.clientHeight || row * FONT_PICKER_VISIBLE_ROWS;
    if (index * row < element.scrollTop) element.scrollTop = index * row;
    else if ((index + 1) * row > element.scrollTop + height) {
      element.scrollTop = (index + 1) * row - height;
    }
    setTop(element.scrollTop);
  };
  const filter = (value: string): void => {
    setQuery(value);
    setPointed(filterFamilies(options, value)[0]?.value ?? '');
    if (viewport.current !== null) viewport.current.scrollTop = 0;
    setTop(0);
  };
  const choose = (index: number): void => {
    const choice = choices[index];
    if (choice === undefined) return;
    onSelect(choice.value);
    onClose(true);
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isComposing(event)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose(true);
      return;
    }
    if (
      event.target instanceof HTMLInputElement &&
      ['Home', 'End', ' '].includes(event.key)
    ) {
      return;
    }
    if (choices.length === 0) return;
    if (event.key === 'ArrowDown') point((active + 1) % choices.length);
    else if (event.key === 'ArrowUp') {
      point((active - 1 + choices.length) % choices.length);
    } else if (event.key === 'Home') point(0);
    else if (event.key === 'End') point(choices.length - 1);
    else if (event.key === 'Enter' || event.key === ' ') choose(active);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
  const start = Math.max(0, Math.floor(top / row) - OVERSCAN);
  const visible = choices.slice(
    start,
    start + FONT_PICKER_VISIBLE_ROWS + OVERSCAN * 2,
  );
  const activeId =
    active >= start && active < start + visible.length
      ? `${id}-${active}`
      : undefined;
  return {
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
  };
}
