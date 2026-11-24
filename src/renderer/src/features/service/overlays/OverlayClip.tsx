import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type {ItemOverlayId} from '@core/schema/common/ids';
import {resizedSpan, type OverlaySpan} from '@core/overlays';
import {editorTask} from '@renderer/platform/editorTask';
import {isComposing} from '@renderer/ui/fields/ime';
import {hasModifier} from '@renderer/ui/keys/modifierKeys';
import {OverlayPopover} from './OverlayPopover';
import type {OverlayControl} from './useOverlayControl';
import styles from './ItemOverlays.module.css';

const SLIDE = '[data-slide-index]';

interface Box {
  /** The place of its slide, from 0. */
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface Drag {
  readonly id: ItemOverlayId;
  readonly edge: 'from' | 'to';
  readonly span: OverlaySpan;
}

function sameBoxes(a: readonly Box[], b: readonly Box[]): boolean {
  return (
    a.length === b.length &&
    a.every((box, index) => {
      const other = b[index];
      return (
        box.index === other?.index &&
        box.left === other.left &&
        box.top === other.top &&
        box.right === other.right &&
        box.bottom === other.bottom
      );
    })
  );
}

function measure(layer: HTMLElement): readonly Box[] {
  const origin = layer.getBoundingClientRect();
  const parent = layer.parentElement;
  if (parent === null) return [];
  return Array.from(parent.querySelectorAll<HTMLElement>(SLIDE), node => {
    const rect = node.getBoundingClientRect();
    return {
      index: Number(node.dataset['slideIndex']),
      left: rect.left - origin.left,
      top: rect.top - origin.top,
      right: rect.right - origin.left,
      bottom: rect.bottom - origin.top,
    };
  });
}

/** The place of the slide, from 1, nearest to a point of the grid. */
function slideAt(
  boxes: readonly Box[],
  point: {readonly x: number; readonly y: number},
): number | undefined {
  let found: Box | undefined;
  let distance = Infinity;
  for (const box of boxes) {
    const away = Math.hypot(
      (box.left + box.right) / 2 - point.x,
      (box.top + box.bottom) / 2 - point.y,
    );
    if (away >= distance) continue;
    distance = away;
    found = box;
  }
  return found === undefined ? undefined : found.index + 1;
}

/** The parts of a span on each row of slides that is drawn. */
function segmentsOf(
  span: OverlaySpan,
  boxes: readonly Box[],
): ReadonlyArray<{readonly first: Box; readonly last: Box}> {
  const rows = new Map<number, {first: Box; last: Box}>();
  for (const box of boxes) {
    if (box.index + 1 < span.from || box.index + 1 > span.to) continue;
    const row = Math.round(box.top);
    const known = rows.get(row);
    if (known === undefined) rows.set(row, {first: box, last: box});
    else if (box.index < known.first.index) known.first = box;
    else if (box.index > known.last.index) known.last = box;
  }
  return [...rows.values()];
}

/**
 * The 오버레이 clips under the slides of the grid that holds this layer: one
 * bar for each row of slides an 오버레이 covers, › where it runs on, and a
 * handle at each real end. Mount it as the last child of a positioned parent
 * whose slides are `option`s. It also takes media files dropped on the slides.
 */
export function OverlayClips({
  control,
  revision,
}: {
  readonly control: OverlayControl;
  /** Changes when the slides are laid out again. */
  readonly revision: string;
}): JSX.Element {
  const {editing} = control;
  const layer = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<readonly Box[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [popover, setPopover] = useState<{
    readonly id: ItemOverlayId;
    readonly anchor: DOMRect;
  } | null>(null);

  const update = useCallback((): void => {
    const node = layer.current;
    if (node === null) return;
    const next = measure(node);
    setBoxes(current => (sameBoxes(current, next) ? current : next));
  }, []);
  useLayoutEffect(() => {
    update();
    const parent = layer.current?.parentElement;
    if (
      parent === null ||
      parent === undefined ||
      typeof ResizeObserver === 'undefined'
    ) {
      return undefined;
    }
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [update, editing.count, revision]);

  const startDrag = (
    event: PointerEvent<HTMLElement>,
    id: ItemOverlayId,
    edge: Drag['edge'],
  ): void => {
    const overlay = editing.overlays.find(row => row.id === id);
    if (overlay === undefined || editing.reason !== undefined) return;
    event.preventDefault();
    event.stopPropagation();
    setDrag({id, edge, span: {from: overlay.from, to: overlay.to}});
  };
  const moveDrag = (event: globalThis.PointerEvent): void => {
    const node = layer.current;
    if (drag === null || node === null) return;
    const origin = node.getBoundingClientRect();
    const position = slideAt(boxes, {
      x: event.clientX - origin.left,
      y: event.clientY - origin.top,
    });
    if (position === undefined) return;
    const span = resizedSpan({
      overlays: editing.overlays,
      id: drag.id,
      edge: drag.edge,
      position,
      total: editing.count,
    });
    if (span !== undefined) setDrag({...drag, span});
  };
  const endDrag = (): void => {
    if (drag === null) return;
    const {id, span} = drag;
    setDrag(null);
    const overlay = editing.overlays.find(row => row.id === id);
    if (
      overlay === undefined ||
      (overlay.from === span.from && overlay.to === span.to)
    ) {
      return;
    }
    editorTask(
      editing.change(current =>
        current.map(row =>
          row.id === id ? {...row, from: span.from, to: span.to} : row,
        ),
      ),
    );
  };
  // NOTE(0913vision): The handle that started a drag leaves the page when its
  // end moves to another row, so the drag listens on the document instead.
  const onMove = useEffectEvent(moveDrag);
  const onEnd = useEffectEvent(endDrag);
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return undefined;
    const cancel = (): void => setDrag(null);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', cancel);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', cancel);
    };
  }, [dragging]);
  const keyDown = (event: KeyboardEvent, id: ItemOverlayId): void => {
    if (isComposing(event) || hasModifier(event)) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      control.remove(id);
    }
  };

  const shown =
    popover === null
      ? undefined
      : editing.overlays.find(row => row.id === popover.id);
  return (
    <div ref={layer} className={styles.layer}>
      {editing.overlays.flatMap(overlay => {
        const span: OverlaySpan =
          drag?.id === overlay.id
            ? drag.span
            : {from: overlay.from, to: overlay.to};
        const label = `${overlay.name}, 슬라이드 ${overlay.from}부터 ${overlay.to}까지`;
        return segmentsOf(span, boxes).map(({first, last}) => {
          const before = first.index + 1 > span.from;
          const after = last.index + 1 < span.to;
          const primary = !before;
          return (
            <div
              key={`${overlay.id}:${first.index}`}
              className={styles.clip}
              data-overlay-clip=""
              data-chosen={control.chosen === overlay.id ? '' : undefined}
              data-dragging={drag?.id === overlay.id ? '' : undefined}
              style={{
                left: first.left,
                top: first.bottom,
                width: last.right - first.left,
              }}
            >
              <button
                type="button"
                className={styles.bar}
                aria-label={label}
                aria-pressed={control.chosen === overlay.id}
                aria-hidden={primary ? undefined : true}
                tabIndex={primary ? undefined : -1}
                onClick={event => {
                  control.choose(overlay.id);
                  setPopover({
                    id: overlay.id,
                    anchor: event.currentTarget.getBoundingClientRect(),
                  });
                }}
                onKeyDown={event => keyDown(event, overlay.id)}
              >
                {before ? <span aria-hidden="true">‹</span> : null}
                <span className={styles.barName}>{overlay.name}</span>
                {after ? <span aria-hidden="true">›</span> : null}
              </button>
              {before ? null : (
                <span
                  className={styles.handle}
                  data-edge="from"
                  aria-hidden="true"
                  onPointerDown={event => startDrag(event, overlay.id, 'from')}
                />
              )}
              {after ? null : (
                <span
                  className={styles.handle}
                  data-edge="to"
                  aria-hidden="true"
                  onPointerDown={event => startDrag(event, overlay.id, 'to')}
                />
              )}
            </div>
          );
        });
      })}
      {popover === null || shown === undefined ? null : (
        <OverlayPopover
          overlay={shown}
          control={control}
          anchor={popover.anchor}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}
