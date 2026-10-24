import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {ColumnLayout} from './ColumnLayout';
import type {ColumnDrag} from './ColumnGap';
import type {ColumnWidthStore} from './columnWidthStore';
import type {ColumnWidths, SizeClass} from './sizeClass';

const LEFT_VARIABLE = '--ll-col-left';
const RIGHT_VARIABLE = '--ll-col-right';

function showOn(grid: HTMLElement, {left, right}: ColumnWidths): void {
  grid.style.setProperty(LEFT_VARIABLE, `${left}px`);
  grid.style.setProperty(RIGHT_VARIABLE, `${right}px`);
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
    return () => {
      unwatch();
      layoutRef.current = null;
    };
  }, [store, firstSizeClass]);

  useLayoutEffect(() => {
    layoutRef.current?.setSizeClass(sizeClass);
    layoutRef.current?.refit();
  }, [store, sizeClass]);

  const drag = useMemo<ColumnDrag>(
    () => ({begin: column => layoutRef.current?.beginDrag(column)}),
    [],
  );
  return {gridRef, drag};
}
