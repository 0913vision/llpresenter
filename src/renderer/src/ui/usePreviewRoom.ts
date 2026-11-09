import {useLayoutEffect, useState, type RefObject} from 'react';
import {flushSync} from 'react-dom';

/** A length token in px, read where `el` sits. */
function tokenPx(el: HTMLElement, token: string): number {
  const probe = el.ownerDocument.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;width:var(${token})`;
  el.append(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();
  return px;
}

/** What the large picture, the tile row, and what sits around them need. */
export interface PreviewNeed {
  /** The width of the picture area, inside the panel inset. */
  readonly width: number;
  /** The number of small tiles. */
  readonly tiles: number;
  /** Height of rows below the picture area, such as a progress bar. */
  readonly extra: number;
}

/** The height of a large picture with its caption, the tile row, and the panel around them. */
export function previewHeightWith(
  el: HTMLElement,
  need: PreviewNeed,
  withTiles: boolean,
): number {
  const header = tokenPx(el, '--size-panel-header');
  const inset = tokenPx(el, '--panel-inset');
  const caption = tokenPx(el, '--size-control-md');
  const smallCaption = tokenPx(el, '--size-control-sm');
  const rowGap = tokenPx(el, '--space-12');
  const gap = tokenPx(el, '--space-8');
  const smallMax = tokenPx(el, '--size-preview-small-max');
  const big = (need.width * 9) / 16 + caption;
  let height = header + 2 * inset + big + need.extra;
  if (withTiles && need.tiles > 0) {
    const tileWidth = Math.min(
      (need.width - gap * (need.tiles - 1)) / need.tiles,
      smallMax,
    );
    height += rowGap + (tileWidth * 9) / 16 + smallCaption;
  }
  return height;
}

/** The panel that holds the picture: a workspace panel, or an ordinary one. */
function hostOf(el: HTMLElement): HTMLElement | null {
  return (
    el.closest<HTMLElement>('[data-resize-panel]') ??
    el.closest<HTMLElement>('section')
  );
}

/**
 * The height the panel can have. A height a splitter gave it counts as it is.
 * Otherwise a workspace panel gets what its column leaves after the minimum
 * heights of its neighbors (their heights do not depend on this panel's
 * content), and an ordinary panel, which fills its window, gets its own height.
 */
function availableHeight(host: HTMLElement): number {
  const own = host.getBoundingClientRect().height;
  if (host.style.height !== '') return own;
  const column = host.parentElement;
  if (column === null || !host.hasAttribute('data-resize-panel')) return own;
  const style = getComputedStyle(column);
  let height =
    column.clientHeight -
    (parseFloat(style.paddingTop) || 0) -
    (parseFloat(style.paddingBottom) || 0);
  const sharedLimit =
    style.getPropertyValue('--preview-reserve').trim() === ''
      ? height
      : height - tokenPx(host, '--preview-reserve');
  for (const child of column.children) {
    if (child === host || !(child instanceof HTMLElement)) continue;
    const fixed =
      child.hasAttribute('data-resize-fixed') ||
      !child.hasAttribute('data-resize-panel') ||
      child.style.height !== '';
    height -= fixed
      ? child.getBoundingClientRect().height
      : parseFloat(getComputedStyle(child).minHeight) || 0;
  }
  return Math.min(height, sharedLimit);
}

/**
 * Whether the tile row fits under the large picture. The tile row is the first
 * thing a short column gives up; the large picture shrinks only after it.
 *
 * @param anchor - An element inside the panel body; its width is the picture
 * area's.
 */
export function usePreviewRoom(
  anchor: RefObject<HTMLElement | null>,
  {
    tiles,
    extra,
  }: {
    readonly tiles: number;
    readonly extra: (anchor: HTMLElement) => number;
  },
): boolean {
  const [room, setRoom] = useState(true);
  useLayoutEffect(() => {
    const el = anchor.current;
    if (el === null) return undefined;
    const host = hostOf(el);
    if (host === null) return undefined;
    const measure = (sync: boolean): void => {
      const inset = tokenPx(el, '--panel-inset');
      const width = el.clientWidth - 2 * inset;
      if (width <= 0) return;
      const need = previewHeightWith(
        el,
        {width, tiles, extra: extra(el)},
        true,
      );
      const next = availableHeight(host) >= need;
      // NOTE(0913vision): A resize changes the tile row in the frame of the
      // resize, before it paints, so the picture never shows a second step.
      if (sync) flushSync(() => setRoom(next));
      else setRoom(next);
    };
    measure(false);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measure(true));
    observer.observe(el);
    observer.observe(host);
    if (host.parentElement !== null) observer.observe(host.parentElement);
    return () => observer.disconnect();
  }, [anchor, tiles, extra]);
  return room;
}
