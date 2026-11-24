import {useLayoutEffect, useRef, type RefObject} from 'react';

/** Scrolls the slide an edit or a key selected into view, and no further. */
export function useRevealInsertedSlide({
  viewport,
  ids,
  offsets,
  columns,
  focused,
  intent,
}: {
  readonly viewport: RefObject<HTMLDivElement | null>;
  readonly ids: readonly string[];
  readonly offsets: readonly number[];
  readonly columns: number;
  readonly focused: number;
  readonly intent: number;
}): void {
  const shown = useRef({intent, id: ids[focused], count: ids.length});
  useLayoutEffect(() => {
    const before = shown.current;
    const id = ids[focused];
    shown.current = {intent, id, count: ids.length};
    const node = viewport.current;
    if (
      id === undefined ||
      node === null ||
      node.clientHeight === 0 ||
      (before.intent === intent && before.id === id)
    ) {
      return;
    }
    const row = Math.floor(focused / columns);
    const top = offsets[row] ?? 0;
    const bottom = offsets[row + 1] ?? top;
    const target =
      top < node.scrollTop || bottom - top > node.clientHeight
        ? top
        : bottom > node.scrollTop + node.clientHeight
          ? bottom - node.clientHeight
          : node.scrollTop;
    if (target === node.scrollTop) return;
    node.scrollTo({
      top: target,
      behavior: before.count === ids.length ? 'instant' : 'smooth',
    });
  }, [viewport, ids, offsets, columns, focused, intent]);
}
