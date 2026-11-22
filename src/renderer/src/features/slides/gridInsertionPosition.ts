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

/** Keeps the final marker inside a viewport when the last row is full. */
export function visibleGridInsertionPosition(
  input: Parameters<typeof gridInsertionPosition>[0],
  edge = 8,
): {readonly top: number; readonly left: string; readonly height: number} {
  const position = gridInsertionPosition(input);
  return {...position, left: `min(${position.left}px, calc(100% - ${edge}px))`};
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

/** Finds the insertion gap nearest a click in a slide viewport's empty space. */
export function emptySlideGap(
  viewport: HTMLElement,
  {
    x,
    y,
    count,
  }: {readonly x: number; readonly y: number; readonly count: number},
): number {
  const slides = [
    ...viewport.querySelectorAll<HTMLElement>('[data-slide-index]'),
  ]
    .map(node => ({
      index: Number(node.dataset.slideIndex),
      rect: node.getBoundingClientRect(),
    }))
    .filter(
      slide =>
        Number.isInteger(slide.index) &&
        slide.index >= 0 &&
        slide.index < count,
    );
  if (slides.length === 0) return 0;
  const grid =
    viewport.dataset.view === 'grid' || viewport.dataset.editor === 'true';
  if (!grid) {
    const gaps = slides.flatMap(({index, rect}) => [
      {index, distance: Math.abs(y - rect.top)},
      {index: index + 1, distance: Math.abs(y - rect.bottom)},
    ]);
    return gaps.reduce((best, next) =>
      next.distance < best.distance ? next : best,
    ).index;
  }
  const distance = (rect: DOMRect): number =>
    y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  const last = slides.find(slide => slide.index === count - 1);
  if (last !== undefined && y > last.rect.bottom) return count;
  const nearest = slides.reduce((best, next) =>
    distance(next.rect) < distance(best.rect) ? next : best,
  );
  const row = slides.filter(
    slide => Math.abs(slide.rect.top - nearest.rect.top) < 2,
  );
  const gaps = row.flatMap(({index, rect}) => [
    {index, distance: Math.abs(x - rect.left)},
    {index: index + 1, distance: Math.abs(x - rect.right)},
  ]);
  return gaps.reduce((best, next) =>
    next.distance < best.distance ? next : best,
  ).index;
}
