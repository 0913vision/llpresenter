import {useLayoutEffect, useState, type RefObject} from 'react';
import {useMeasuredSize} from './useMeasuredSize';

export interface GridMeasure {
  readonly width: number;
  readonly gap: number;
}

export function useGridMeasure(
  container: RefObject<HTMLElement | null>,
  selector: string,
): GridMeasure {
  const [grid, setGrid] = useState<HTMLElement | null>(null);
  const [measure, setMeasure] = useState<GridMeasure>({width: 0, gap: 0});
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const attach = (): void =>
      setGrid(root.querySelector<HTMLElement>(selector));
    attach();
    const swaps =
      typeof MutationObserver === 'undefined'
        ? undefined
        : new MutationObserver(attach);
    swaps?.observe(root, {childList: true, subtree: true});
    return () => swaps?.disconnect();
  }, [container, selector]);
  useMeasuredSize(
    () => grid,
    (node, entry) => {
      if (!node.isConnected) return;
      const css = getComputedStyle(node);
      const px = (value: string): number => parseFloat(value) || 0;
      const width =
        entry?.contentRect.width ??
        Math.max(
          0,
          node.getBoundingClientRect().width -
            px(css.borderLeftWidth) -
            px(css.borderRightWidth) -
            px(css.paddingLeft) -
            px(css.paddingRight),
        );
      const next = {width, gap: px(css.columnGap)};
      setMeasure(old =>
        old.width === next.width && old.gap === next.gap ? old : next,
      );
    },
    grid,
  );
  return measure;
}
