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
import type {ItemOverlayId} from '@core/schema/ids';
import {
  clipSegments,
  nearestSlide,
  resizedSpan,
  type OverlaySpan,
} from '@core/themes/overlayRanges';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {hasMediaDrag, readMediaDrag} from '@renderer/features/media/mediaDrag';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {OverlayPopover} from './OverlayPopover';
import type {OverlayControl} from './useOverlayControl';
import styles from './ItemOverlays.module.css';

const SLIDE = '[role="option"]';

interface Box {
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
        box.left === other?.left &&
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
  return Array.from(parent.querySelectorAll(SLIDE), node => {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left - origin.left,
      top: rect.top - origin.top,
      right: rect.right - origin.left,
      bottom: rect.bottom - origin.top,
    };
  });
}

/** How many slides share the first row. */
function columnsOf(boxes: readonly Box[]): number {
  const first = boxes[0];
  if (first === undefined) return 0;
  return boxes.filter(box => Math.abs(box.top - first.top) < 1).length;
}

/** The slide, by place from 1, nearest to a point of the grid. */
function slideAt(
  boxes: readonly Box[],
  columns: number,
  point: {readonly x: number; readonly y: number},
): number | undefined {
  if (columns < 1) return undefined;
  let row = 0;
  let distance = Infinity;
  for (let at = 0; at * columns < boxes.length; at++) {
    const box = boxes[at * columns];
    if (box === undefined) continue;
    const gap = Math.abs((box.top + box.bottom) / 2 - point.y);
    if (gap < distance) {
      distance = gap;
      row = at;
    }
  }
  const found = nearestSlide(
    point.x,
    boxes
      .slice(row * columns, (row + 1) * columns)
      .map(box => (box.left + box.right) / 2),
  );
  return found === undefined ? undefined : row * columns + found;
}

/**
 * The 오버레이 clips under the slides of the grid that holds this layer: one
 * bar for each row of slides an 오버레이 covers, › where it runs on, and a
 * handle at each real end. Mount it as the last child of a positioned parent
 * whose slides are `option`s. It also takes media files dropped on the slides.
 */
export function OverlayClips({
  control,
  positionOffset = 0,
}: {
  readonly control: OverlayControl;
  readonly positionOffset?: number;
}): JSX.Element {
  const {editing} = control;
  const layer = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<readonly Box[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [popover, setPopover] = useState<{
    readonly id: ItemOverlayId;
    readonly anchor: DOMRect;
  } | null>(null);
  const columns = columnsOf(boxes);

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
  }, [update, editing.count, positionOffset]);

  useLayoutEffect(() => {
    const parent = layer.current?.parentElement;
    if (parent === null || parent === undefined) return undefined;
    const slideIndex = (target: EventTarget | null): number | undefined => {
      if (!(target instanceof Element)) return undefined;
      const slide = target.closest(SLIDE);
      if (slide === null) return undefined;
      const index = Array.from(parent.querySelectorAll(SLIDE)).indexOf(slide);
      return index < 0 ? undefined : index;
    };
    const over = (event: DragEvent): void => {
      if (event.dataTransfer === null || !hasMediaDrag(event.dataTransfer)) {
        return;
      }
      const index = slideIndex(event.target);
      if (index === undefined || editing.reason !== undefined) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setDropAt(index);
    };
    const drop = (event: DragEvent): void => {
      setDropAt(null);
      if (event.dataTransfer === null || !hasMediaDrag(event.dataTransfer)) {
        return;
      }
      const index = slideIndex(event.target);
      const media = readMediaDrag(event.dataTransfer);
      if (index === undefined || media === undefined) return;
      event.preventDefault();
      control.dropMedia(index + 1 + positionOffset, media);
    };
    const leave = (): void => setDropAt(null);
    parent.addEventListener('dragover', over);
    parent.addEventListener('drop', drop);
    parent.addEventListener('dragleave', leave);
    return () => {
      parent.removeEventListener('dragover', over);
      parent.removeEventListener('drop', drop);
      parent.removeEventListener('dragleave', leave);
    };
  }, [control, editing.reason, positionOffset]);

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
    const position = slideAt(boxes, columns, {
      x: event.clientX - origin.left,
      y: event.clientY - origin.top,
    });
    if (position === undefined) return;
    const span = resizedSpan({
      overlays: editing.overlays,
      id: drag.id,
      edge: drag.edge,
      position: position + positionOffset,
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
  const dropBox = dropAt === null ? undefined : boxes[dropAt];
  return (
    <div ref={layer} className={styles.layer}>
      {dropBox === undefined ? null : (
        <div
          className={styles.dropTarget}
          style={{
            left: dropBox.left,
            top: dropBox.top,
            width: dropBox.right - dropBox.left,
            height: dropBox.bottom - dropBox.top,
          }}
        />
      )}
      {editing.overlays.flatMap(overlay => {
        const globalSpan: OverlaySpan =
          drag?.id === overlay.id
            ? drag.span
            : {from: overlay.from, to: overlay.to};
        if (
          globalSpan.to <= positionOffset ||
          globalSpan.from > positionOffset + boxes.length
        ) {
          return [];
        }
        const span = {
          from: Math.max(1, globalSpan.from - positionOffset),
          to: Math.min(boxes.length, globalSpan.to - positionOffset),
        };
        const label = `${overlay.name}, 슬라이드 ${overlay.from}부터 ${overlay.to}까지`;
        return clipSegments(span, columns).flatMap(segment => {
          const first = boxes[segment.row * columns + segment.firstColumn];
          const last = boxes[segment.row * columns + segment.lastColumn];
          if (first === undefined || last === undefined) return [];
          const before =
            segment.continuesBefore || globalSpan.from <= positionOffset;
          const after =
            segment.continuesAfter ||
            globalSpan.to > positionOffset + boxes.length;
          const primary = segment.row === 0 || !segment.continuesBefore;
          return [
            <div
              key={`${overlay.id}:${segment.row}`}
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
            </div>,
          ];
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
      {control.dialog}
    </div>
  );
}
