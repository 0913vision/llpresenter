import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';

// NOTE(0913vision): The same threshold as dragging a 라이브러리 row (spec 05).
const DRAG_THRESHOLD_PX = 4;
const CHIP_SELECTOR = '[role="option"]';

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

interface ChipDrag {
  readonly from: number;
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly started: boolean;
  readonly drop: number;
}

function middle(low: number, high: number): number {
  return (low + high) / 2;
}

/**
 * Where a chip dropped at the point lands, from 0 (before the first) to the
 * chip count (after the last), in a strip that wraps onto several rows.
 */
export function dropIndexAt(
  boxes: readonly Box[],
  x: number,
  y: number,
): number {
  const first = boxes[0];
  if (first === undefined) return 0;
  const distance = (box: Box): number =>
    Math.abs(middle(box.top, box.bottom) - y);
  const row = boxes.reduce((nearest, box) =>
    distance(box) < distance(nearest) ? box : nearest,
  );
  const inRow = (box: Box): boolean =>
    box.top < row.bottom && box.bottom > row.top;
  let last = -1;
  for (const [index, box] of boxes.entries()) {
    if (!inRow(box)) continue;
    if (x < middle(box.left, box.right)) return index;
    last = index;
  }
  return last + 1;
}

function chipIndex(strip: Element, target: EventTarget): number {
  const chip = target instanceof Element ? target.closest(CHIP_SELECTOR) : null;
  return chip === null
    ? -1
    : [...strip.querySelectorAll(CHIP_SELECTOR)].indexOf(chip);
}

function changesOrder(from: number, drop: number): boolean {
  return drop !== from && drop !== from + 1;
}

/**
 * Pointer dragging for the 구성 strip. A press on a chip that moves more than
 * 4 px starts a drag; releasing it moves the chip to the drop position, and
 * Esc cancels. The click that ends a drag doesn't select a chip.
 */
export function useChipDrag({
  enabled,
  onMove,
}: {
  readonly enabled: boolean;
  readonly onMove: (from: number, to: number) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const endedDrag = useRef(false);
  const [drag, setDrag] = useState<ChipDrag | null>(null);
  const tracking = drag !== null;

  const follow = useEffectEvent((event: globalThis.PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) return;
    const started =
      drag.started ||
      Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >
        DRAG_THRESHOLD_PX;
    if (!started) return;
    const boxes = [
      ...(strip.current?.querySelectorAll(CHIP_SELECTOR) ?? []),
    ].map(chip => chip.getBoundingClientRect());
    const drop = dropIndexAt(boxes, event.clientX, event.clientY);
    if (started !== drag.started || drop !== drag.drop) {
      setDrag({...drag, started, drop});
    }
  });
  const finish = useEffectEvent((event: globalThis.PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) return;
    setDrag(null);
    if (!drag.started) return;
    endedDrag.current = true;
    if (changesOrder(drag.from, drag.drop)) {
      onMove(drag.from, drag.drop > drag.from ? drag.drop - 1 : drag.drop);
    }
  });
  const cancel = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (event.key !== 'Escape' || drag?.started !== true) return;
    event.preventDefault();
    event.stopPropagation();
    endedDrag.current = true;
    setDrag(null);
  });

  useEffect(() => {
    if (!tracking) return undefined;
    const move = (event: globalThis.PointerEvent): void => follow(event);
    const up = (event: globalThis.PointerEvent): void => finish(event);
    const lost = (): void => setDrag(null);
    const key = (event: globalThis.KeyboardEvent): void => cancel(event);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', lost);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', lost);
      window.removeEventListener('keydown', key, true);
    };
  }, [tracking]);

  const shown = drag?.started === true ? drag : undefined;
  return {
    draggingIndex: shown?.from,
    dropIndex:
      shown !== undefined && changesOrder(shown.from, shown.drop)
        ? shown.drop
        : undefined,
    stripProps: {
      ref: strip,
      onPointerDown: (event: PointerEvent<HTMLDivElement>): void => {
        endedDrag.current = false;
        if (!enabled || event.button !== 0 || strip.current === null) return;
        const from = chipIndex(strip.current, event.target);
        if (from < 0) return;
        setDrag({
          from,
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          started: false,
          drop: from,
        });
      },
      onClickCapture: (event: MouseEvent<HTMLDivElement>): void => {
        if (!endedDrag.current) return;
        endedDrag.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    },
  };
}
