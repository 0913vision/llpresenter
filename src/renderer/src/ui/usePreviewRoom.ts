import {
  isHiddenWorkspace,
  onWorkspaceVisible,
  workspaceFrame,
} from '@renderer/ui/workspaceVisibility';
import {useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {flushSync} from 'react-dom';

/** The lengths around the pictures, in px where the panel body sits. */
interface PanelLengths {
  readonly header: number;
  readonly inset: number;
  readonly caption: number;
  readonly smallCaption: number;
  readonly rowGap: number;
  readonly gap: number;
  readonly smallMax: number;
  readonly reserve: number;
  readonly panelGap: number;
}

const LENGTH_TOKENS: ReadonlyArray<readonly [keyof PanelLengths, string]> = [
  ['header', '--size-panel-header'],
  ['inset', '--panel-inset'],
  ['caption', '--size-control-md'],
  ['smallCaption', '--size-control-sm'],
  ['rowGap', '--space-12'],
  ['gap', '--space-8'],
  ['smallMax', '--size-preview-small-max'],
  ['reserve', '--preview-reserve'],
  ['panelGap', '--panel-gap'],
];

/**
 * Reads the length tokens where `el` sits and hands them to `measure` while
 * the probes are still in place. Every probe goes in before the first is read
 * and they take no room, so the probes and what `measure` reads share one
 * layout.
 */
function withLengths<T>(
  el: HTMLElement,
  measure: (lengths: PanelLengths) => T,
): T {
  const box = el.ownerDocument.createElement('div');
  box.style.cssText =
    'position:absolute;visibility:hidden;width:0;height:0;overflow:hidden';
  const probes = LENGTH_TOKENS.map(([key, token]) => {
    const probe = el.ownerDocument.createElement('div');
    probe.style.cssText = `position:absolute;width:var(${token})`;
    box.append(probe);
    return [key, probe] as const;
  });
  el.append(box);
  try {
    const px = new Map(
      probes.map(([key, probe]) => [key, probe.getBoundingClientRect().width]),
    );
    const length = (key: keyof PanelLengths): number => px.get(key) ?? 0;
    return measure({
      header: length('header'),
      inset: length('inset'),
      caption: length('caption'),
      smallCaption: length('smallCaption'),
      rowGap: length('rowGap'),
      gap: length('gap'),
      smallMax: length('smallMax'),
      reserve: length('reserve'),
      panelGap: length('panelGap'),
    });
  } finally {
    box.remove();
  }
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
function previewHeightWith(
  {header, inset, caption, smallCaption, rowGap, gap, smallMax}: PanelLengths,
  need: PreviewNeed,
  withTiles: boolean,
): number {
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
function availableHeight(host: HTMLElement, lengths: PanelLengths): number {
  const own = host.getBoundingClientRect().height;
  if (host.style.height !== '') return own;
  const column = host.parentElement;
  if (column === null || !host.hasAttribute('data-resize-panel')) return own;
  const workspace = host.closest<HTMLElement>('[data-workspace-layout="show"]');
  if (host.dataset['resizePanel'] === 'show.preview' && workspace !== null) {
    return Math.max(
      0,
      workspace.clientHeight -
        lengths.header -
        lengths.panelGap -
        lengths.reserve,
    );
  }
  const style = getComputedStyle(column);
  let height =
    column.clientHeight -
    (parseFloat(style.paddingTop) || 0) -
    (parseFloat(style.paddingBottom) || 0);
  const sharedLimit =
    style.getPropertyValue('--preview-reserve').trim() === ''
      ? height
      : height - lengths.reserve;
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
  const known = useRef<{
    readonly tiles: number;
    readonly extra: (anchor: HTMLElement) => number;
    readonly room: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    const el = anchor.current;
    if (el === null) return undefined;
    const host = hostOf(el);
    if (host === null) return undefined;
    const frame = workspaceFrame(el);
    // NOTE(0913vision): A panel shown again with the same tiles keeps its
    // answer; the first resize observation checks it before the frame paints,
    // so showing it reads no layout first.
    const kept =
      known.current?.tiles === tiles && known.current.extra === extra
        ? known.current.room
        : null;
    let last: boolean | null = kept;
    const measure = (sync: boolean): void => {
      if (isHiddenWorkspace(frame)) return;
      const next = withLengths(el, lengths => {
        const width = el.clientWidth - 2 * lengths.inset;
        if (width <= 0) return null;
        const need = previewHeightWith(
          lengths,
          {width, tiles, extra: extra(el)},
          true,
        );
        return availableHeight(host, lengths) >= need;
      });
      // NOTE(0913vision): An unchanged answer renders nothing; a forced render
      // here would redraw the panel before its first frame for no change.
      if (next === null || next === last) return;
      last = next;
      known.current = {tiles, extra, room: next};
      // NOTE(0913vision): A resize changes the tile row in the frame of the
      // resize, before it paints, so the picture never shows a second step.
      if (sync) flushSync(() => setRoom(next));
      else setRoom(next);
    };
    const unwatch = onWorkspaceVisible(frame, () => measure(true));
    if (kept === null || typeof ResizeObserver === 'undefined') {
      measure(false);
    }
    if (typeof ResizeObserver === 'undefined') return unwatch;
    const observer = new ResizeObserver(() => measure(true));
    observer.observe(el);
    observer.observe(host);
    if (host.parentElement !== null) observer.observe(host.parentElement);
    return () => {
      unwatch();
      observer.disconnect();
    };
  }, [anchor, tiles, extra]);
  return room;
}
