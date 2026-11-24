import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {ColumnLayout} from './ColumnLayout';
import type {ColumnDrag} from './ColumnGap';
import type {RightColumn} from './columns';
import type {ColumnWidthStore} from './columnWidthStore';
import type {ColumnWidths, SizeClass} from '@renderer/ui/panels/sizeClass';

const LEFT_VARIABLE = '--ll-col-left';
const RIGHT_VARIABLE = '--ll-col-right';
const PREP_RIGHT_VARIABLE = '--ll-col-prep-right';

function showOn(
  grid: HTMLElement,
  {left, right, prepRight}: ColumnWidths,
): void {
  grid.style.setProperty(LEFT_VARIABLE, `${left}px`);
  grid.style.setProperty(RIGHT_VARIABLE, `${right}px`);
  grid.style.setProperty(PREP_RIGHT_VARIABLE, `${prepRight}px`);
}

function watchWindowResize(layout: ColumnLayout): () => void {
  let frame = 0;
  const onResize = (): void => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      layout.refit();
    });
  };
  window.addEventListener('resize', onResize);
  return () => {
    window.removeEventListener('resize', onResize);
    cancelAnimationFrame(frame);
  };
}

/**
 * Writes the column widths to the grid as CSS variables, so that dragging does
 * not re-render the panels. Returns the grid ref and the drag callbacks for the
 * gaps.
 */
export function useColumnLayout(
  sizeClass: SizeClass,
  store: ColumnWidthStore,
  right: RightColumn,
): {
  readonly gridRef: RefObject<HTMLElement | null>;
  readonly drag: ColumnDrag;
} {
  const gridRef = useRef<HTMLElement | null>(null);
  const layoutRef = useRef<ColumnLayout | null>(null);
  const [firstSizeClass] = useState(sizeClass);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;
    const layout = new ColumnLayout({
      store,
      sizeClass: firstSizeClass,
      windowWidth: () => window.innerWidth,
      show: widths => showOn(grid, widths),
    });
    layoutRef.current = layout;
    layout.refit();
    const unwatch = watchWindowResize(layout);
    const reset = (): void => layout.reset();
    window.addEventListener('llp-reset-columns', reset);
    return () => {
      unwatch();
      window.removeEventListener('llp-reset-columns', reset);
      layoutRef.current = null;
    };
  }, [store, firstSizeClass]);

  useLayoutEffect(() => {
    layoutRef.current?.setSizeClass(sizeClass);
  }, [store, sizeClass]);

  useLayoutEffect(() => {
    layoutRef.current?.setRight(right);
  }, [store, right]);

  const drag = useMemo<ColumnDrag>(
    () => ({
      begin: column => layoutRef.current?.beginDrag(column),
      reset: column => layoutRef.current?.reset(column),
    }),
    [],
  );
  return {gridRef, drag};
}
