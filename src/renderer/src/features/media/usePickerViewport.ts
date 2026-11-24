import {useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {pickerRowTop} from './mediaPickerChoices';

/** How many rows the list shows at once. */
export const VISIBLE_ROWS = 8;
/** Rows drawn above and below the shown ones, so a fast scroll finds them. */
const OVERSCAN = 2;

type Groups = Parameters<typeof pickerRowTop>[1]['groups'];

/** The height of the divider under the special rows, with its margins. */
function dividerHeight(divider: HTMLElement | null): number {
  if (divider === null) return 0;
  const style = getComputedStyle(divider);
  return (
    divider.getBoundingClientRect().height +
    (Number.parseFloat(style.marginTop) || 0) +
    (Number.parseFloat(style.marginBottom) || 0)
  );
}

/**
 * The scrolled list of the media picker. It measures its rows once they are
 * drawn, opens scrolled to the chosen row, keeps a pointed row in view, and
 * tells which rows to draw: the special rows always, the others only near
 * the view.
 */
export function usePickerViewport({
  surface,
  active,
  count,
  specialCount,
  groups,
  separated,
}: {
  /** The picker's surface, whose search field takes focus at first. */
  readonly surface: RefObject<HTMLElement | null>;
  /** The pointed row. */
  readonly active: number;
  /** How many rows there are. */
  readonly count: number;
  /** The rows above the divider, such as 기본 배경 and 없음. */
  readonly specialCount: number;
  readonly groups: Groups;
  readonly separated: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const separator = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const [top, setTop] = useState(0);
  const [row, setRow] = useState(0);
  const [gap, setGap] = useState(0);
  const rowTop = (index: number): number =>
    pickerRowTop(index, {row, gap, specialCount, groups});

  useLayoutEffect(() => {
    const element = viewport.current;
    if (element === null) return;
    const height =
      Number.parseFloat(
        getComputedStyle(element).getPropertyValue('--size-row-menu'),
      ) || 0;
    if (height !== row) setRow(height);
    const nextGap = dividerHeight(separator.current);
    if (nextGap !== gap) setGap(nextGap);
    if (row > 0 && height === row && !opened.current) {
      opened.current = true;
      surface.current?.querySelector('input')?.focus();
      element.scrollTop =
        active === 0
          ? 0
          : pickerRowTop(active, {row, gap: nextGap, specialCount, groups});
      setTop(element.scrollTop);
    }
  }, [active, row, surface, separated, gap, groups, specialCount]);

  /** Scrolls just enough to show a row. */
  const reveal = (index: number): void => {
    const element = viewport.current;
    if (element === null) return;
    const height = element.clientHeight || row * VISIBLE_ROWS;
    const y = rowTop(index);
    if (index === 0) element.scrollTop = 0;
    else if (y < element.scrollTop) element.scrollTop = y;
    else if (y + row > element.scrollTop + height) {
      element.scrollTop = y + row - height;
    }
    setTop(element.scrollTop);
  };
  const toTop = (): void => {
    if (viewport.current !== null) viewport.current.scrollTop = 0;
    setTop(0);
  };

  const start = Math.max(
    specialCount,
    Math.floor(row > 0 ? Math.max(0, top - gap) / row : 0) -
      groups.length -
      OVERSCAN,
  );
  const end = Math.min(
    count,
    start + VISIBLE_ROWS + OVERSCAN * 2 - specialCount,
  );
  /** Whether a row is drawn and in the view, so it can be the active one. */
  const shows = (index: number): boolean =>
    (index < specialCount &&
      index * row >= top &&
      index * row < top + row * VISIBLE_ROWS) ||
    (index >= start && index < end);

  return {
    viewport,
    separator,
    row,
    gap,
    rowTop,
    reveal,
    toTop,
    onScroll: (scrollTop: number): void => setTop(scrollTop),
    /** The rows below the divider to draw, from `start` up to `end`. */
    start,
    end,
    shows,
  };
}
