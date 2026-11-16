import {useLayoutEffect, useRef, type RefObject} from 'react';

/** Reveal newly inserted rows without moving an already visible list. */
export function useRevealInsertedSlide({
  viewport,
  ids,
  offsets,
  columns,
  leading,
  intent,
  selected,
}: {
  readonly viewport: RefObject<HTMLDivElement | null>;
  readonly ids: readonly string[];
  readonly offsets: readonly number[];
  readonly columns: number;
  readonly leading: number;
  readonly intent: number;
  readonly selected: ReadonlySet<string>;
}): void {
  const previous = useRef({ids, intent});
  useLayoutEffect(() => {
    const before = previous.current;
    const old = new Set(before.ids);
    const added = ids.findIndex(id => !old.has(id));
    const moved =
      ids.length === before.ids.length &&
      ids.some((id, index) => before.ids[index] !== id)
        ? ids.findIndex(id => selected.has(id))
        : -1;
    previous.current = {ids, intent};
    const node = viewport.current;
    const index = added >= 0 ? added : moved;
    if (
      index < 0 ||
      node === null ||
      node.clientHeight === 0 ||
      before.intent === intent
    ) {
      return;
    }
    const row = Math.floor((index + leading) / columns);
    const top = offsets[row] ?? 0;
    const bottom = offsets[row + 1] ?? top;
    const target =
      top < node.scrollTop
        ? top
        : bottom > node.scrollTop + node.clientHeight
          ? bottom - top > node.clientHeight
            ? top
            : bottom - node.clientHeight
          : node.scrollTop;
    if (target !== node.scrollTop) {
      node.scrollTo({top: target, behavior: 'smooth'});
    }
  }, [viewport, ids, offsets, columns, leading, intent, selected]);
}
