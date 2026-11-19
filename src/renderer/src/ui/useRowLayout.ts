import {
  isHiddenWorkspace,
  onWorkspaceVisible,
  workspaceFrame,
} from '@renderer/ui/workspaceVisibility';
import {useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {
  isPanelRowId,
  type PanelRowId,
  type PanelRows,
} from '@core/schema/panelRows';
import type {SizeClass} from '@renderer/ui/sizeClass';
import type {ResizeSession} from '@renderer/ui/ResizeGap';
import {fitRows} from './rows';

export interface RowSizeStore {
  loadRows?(sizeClass: SizeClass): PanelRows | undefined;
  saveRows?(sizeClass: SizeClass, rows: PanelRows): void;
}

interface Row {
  readonly element: HTMLElement;
  readonly id: PanelRowId | undefined;
  readonly minimum: number;
}

function rowPair(
  rows: readonly Row[],
  index: number,
): readonly [number, number] {
  let before = index;
  let after = index + 1;
  while (before >= 0 && rows[before]?.id === undefined) before--;
  while (after < rows.length && rows[after]?.id === undefined) after++;
  return [before, after];
}

interface DragLifetime {
  active: boolean;
  alive: boolean;
}

function beginRowDrag({
  parent,
  rows,
  index,
  lifetime,
  save,
}: {
  readonly parent: HTMLElement;
  readonly rows: readonly Row[];
  readonly index: number;
  readonly lifetime: DragLifetime;
  readonly save: (rows: PanelRows) => void;
}): ResizeSession | undefined {
  if (!lifetime.alive || lifetime.active) return undefined;
  const [before, after] = rowPair(rows, index);
  const top = rows[before];
  const bottom = rows[after];
  if (!top || !bottom) return undefined;
  const heights = rows.map(row => row.element.getBoundingClientRect().height);
  const startTop = heights[before] ?? 0;
  const startBottom = heights[after] ?? 0;
  if (startTop + startBottom <= top.minimum + bottom.minimum) return undefined;
  lifetime.active = true;
  let moved = false;
  return {
    move: delta => {
      if (!lifetime.alive || !lifetime.active) return;
      const movement = Math.max(
        top.minimum - startTop,
        Math.min(startBottom - bottom.minimum, delta),
      );
      moved ||= movement !== 0;
      heights[before] = startTop + movement;
      heights[after] = startBottom - movement;
      writeRows(parent, rows, heights);
    },
    end: () => {
      if (!lifetime.alive || !lifetime.active) return;
      lifetime.active = false;
      if (!moved) return;
      const saved: Partial<Record<PanelRowId, number>> = {};
      rows.forEach((row, at) => {
        const height = heights[at];
        if (row.id !== undefined && height !== undefined) {
          saved[row.id] = height;
        }
      });
      save(saved);
    },
  };
}

function readRows(container: HTMLElement): Row[] {
  return Array.from(container.children).flatMap(element => {
    if (
      !(element instanceof HTMLElement) ||
      element.dataset['resizePanel'] === undefined
    ) {
      return [];
    }
    const id = element.dataset['resizePanel'];
    return [
      {
        element,
        id: isPanelRowId(id) ? id : undefined,
        minimum:
          element.dataset['resizeFixed'] === undefined
            ? parseFloat(getComputedStyle(element).minHeight) || 0
            : element.getBoundingClientRect().height,
      },
    ];
  });
}

function writeRows(
  container: HTMLElement,
  rows: readonly Row[],
  heights: readonly number[],
): void {
  rows.forEach(({element}, index) => {
    const height = heights[index] ?? 0;
    element.style.flex = `0 0 ${height}px`;
    element.style.height = `${height}px`;
    element.style.maxHeight = 'none';
  });
  if (getComputedStyle(container).display !== 'grid') return;
  container.style.gridTemplateRows = heights
    .map(height => `${height}px`)
    .join(' var(--panel-gap) ');
}

/** Resizes adjacent flexible rows, retaining fixed controls and panel minimums. */
function clearRows(parent: HTMLElement, rows: readonly Row[]): void {
  parent.style.removeProperty('grid-template-rows');
  rows.forEach(({element}) => {
    element.style.removeProperty('flex');
    element.style.removeProperty('height');
    element.style.removeProperty('max-height');
  });
}

function rowElements(parent: HTMLElement): HTMLElement[] {
  return Array.from(parent.children).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement &&
      element.dataset['resizePanel'] !== undefined,
  );
}

interface AppliedRows {
  readonly parent: HTMLElement;
  readonly rows: readonly Row[];
  readonly deps: readonly unknown[];
}

export function useRowLayout({
  container,
  store,
  sizeClass,
  layoutKey,
  fill = 'last',
  enabled = true,
  preserveCollapsed = false,
}: {
  readonly container: RefObject<HTMLElement | null>;
  readonly store: RowSizeStore;
  readonly sizeClass: SizeClass;
  readonly layoutKey: string;
  readonly fill?: 'first' | 'last';
  readonly enabled?: boolean;
  readonly preserveCollapsed?: boolean;
}): {
  begin(index: number): ResizeSession | undefined;
  canResize(index: number): boolean;
  reset(): void;
} {
  const [movable, setMovable] = useState<readonly boolean[]>([]);
  const begin = useRef<(index: number) => ResizeSession | undefined>(
    () => undefined,
  );
  const applied = useRef<AppliedRows | null>(null);
  const reset = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    const parent = container.current;
    const deps = [
      parent,
      store,
      sizeClass,
      layoutKey,
      fill,
      enabled,
      preserveCollapsed,
    ];
    // NOTE(0913vision): Rows shown again (진행 stays built while another
    // workspace shows) keep their heights; the resize observer checks them in
    // the first frame, before it paints, so showing them reads no layout
    // first. Rows of another layout start again from their own sizes.
    const last = applied.current;
    const elements = parent ? rowElements(parent) : [];
    const shownAgain =
      last !== null &&
      last.deps.every((value, index) => value === deps[index]) &&
      last.rows.length === elements.length &&
      last.rows.every((row, index) => row.element === elements[index]);
    if (last !== null && !shownAgain) {
      clearRows(last.parent, last.rows);
      applied.current = null;
    }
    if (!parent || !enabled) return undefined;
    const rows = shownAgain ? last.rows : readRows(parent);
    if (rows.length < 2) return undefined;
    applied.current = {parent, rows, deps};
    const lifetime: DragLifetime = {active: false, alive: true};
    const frame = workspaceFrame(parent);
    const updateMovable = (): void => {
      const next = rows.slice(0, -1).map((_, index) => {
        const [before, after] = rowPair(rows, index);
        const top = rows[before];
        const bottom = rows[after];
        return (
          top !== undefined &&
          bottom !== undefined &&
          top.element.getBoundingClientRect().height +
            bottom.element.getBoundingClientRect().height >
            top.minimum + bottom.minimum + 1
        );
      });
      setMovable(previous =>
        previous.length === next.length &&
        previous.every((value, index) => value === next[index])
          ? previous
          : next,
      );
    };
    const refit = (): void => {
      if (!lifetime.alive || lifetime.active || isHiddenWorkspace(frame)) {
        return;
      }
      const saved = store.loadRows?.(sizeClass);
      if (
        !saved ||
        !rows.some(row => row.id !== undefined && saved[row.id] !== undefined)
      ) {
        updateMovable();
        return;
      }
      const preferred = rows.map(row =>
        row.id === undefined
          ? row.minimum
          : (saved[row.id] ?? row.element.getBoundingClientRect().height),
      );
      const style = getComputedStyle(parent);
      const gap = parseFloat(style.getPropertyValue('--panel-gap')) || 0;
      const workspace = preserveCollapsed
        ? parent.closest<HTMLElement>('[data-workspace-layout="show"]')
        : null;
      const collapsedHeight =
        workspace === null
          ? 0
          : workspace.clientHeight -
            (parseFloat(style.getPropertyValue('--size-panel-header')) || 0) -
            gap;
      const available =
        Math.max(parent.clientHeight, collapsedHeight) -
        (rows.length - 1) * gap -
        (parseFloat(style.paddingTop) || 0) -
        (parseFloat(style.paddingBottom) || 0);
      const fillIndex = fill === 'first' ? 0 : rows.length - 1;
      writeRows(
        parent,
        rows,
        fitRows({
          preferred,
          minimums: rows.map(row => row.minimum),
          available,
          fill: fillIndex,
        }),
      );
      updateMovable();
    };
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(refit)
        : undefined;
    if (!shownAgain || observer === undefined) refit();
    observer?.observe(parent);
    window.addEventListener('resize', refit);
    const unwatch = onWorkspaceVisible(frame, refit);
    begin.current = index =>
      beginRowDrag({
        parent,
        rows,
        index,
        lifetime,
        save: saved => {
          store.saveRows?.(sizeClass, saved);
          refit();
        },
      });
    reset.current = () => {
      clearRows(parent, rows);
      const values: PanelRows = Object.fromEntries(
        rows.flatMap(row =>
          row.id === undefined
            ? []
            : [
                [
                  row.id,
                  Math.round(row.element.getBoundingClientRect().height),
                ],
              ],
        ),
      );
      store.saveRows?.(sizeClass, values);
      refit();
    };
    return () => {
      lifetime.alive = false;
      begin.current = () => undefined;
      reset.current = () => undefined;
      observer?.disconnect();
      window.removeEventListener('resize', refit);
      unwatch();
    };
  }, [
    container,
    store,
    sizeClass,
    layoutKey,
    fill,
    enabled,
    preserveCollapsed,
  ]);
  return {
    begin: index => begin.current(index),
    canResize: index => movable[index] === true,
    reset: () => reset.current(),
  };
}
