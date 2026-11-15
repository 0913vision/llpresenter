/** Geometry of an insertion gap in a row-major, optionally prefixed grid. */
export function gridInsertionPosition({
  index,
  count,
  leading,
  columns,
  width,
  columnGap,
  offsets,
  rowGap = 0,
}: {
  readonly index: number;
  readonly count: number;
  readonly leading: number;
  readonly columns: number;
  readonly width: number;
  readonly columnGap: number;
  readonly offsets: readonly number[];
  readonly rowGap?: number;
}): {readonly top: number; readonly left: number; readonly height: number} {
  const afterLast = index >= count && count + leading > 0;
  const position = afterLast ? count + leading - 1 : index + leading;
  const row = Math.floor(position / columns);
  const column = position % columns;
  const top = offsets[row] ?? 0;
  return {
    top,
    left: Math.max(0, column * (width + columnGap) + (afterLast ? width : -8)),
    height: Math.max(0, (offsets[row + 1] ?? top) - top - rowGap),
  };
}

/** Grid cells split left/right; list rows split above/below. */
export function slideDropPosition(
  node: HTMLElement,
  x: number,
  y: number,
): number {
  const gap = node.dataset.slideGap;
  if (gap !== undefined) return Number(gap);
  const rect = node.getBoundingClientRect();
  const listRow =
    node.hasAttribute('data-editor-block') &&
    !node.closest('[data-view="grid"]');
  const after = listRow
    ? y > (rect.top + rect.bottom) / 2
    : x > (rect.left + rect.right) / 2;
  return Number(node.dataset.slideIndex) + (after ? 1 : 0);
}
