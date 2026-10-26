import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';

const DRAG_THRESHOLD_PX = 4;
const ROW = '[data-quick-id]';

interface Drag {
  readonly id: string;
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly started: boolean;
  readonly before: string | null | undefined;
}

function beforeAt(
  list: HTMLElement,
  x: number,
  y: number,
): string | null | undefined {
  const bounds = list.getBoundingClientRect();
  if (
    x < bounds.left ||
    x >= bounds.right ||
    y < bounds.top ||
    y >= bounds.bottom ||
    !list.contains(list.ownerDocument.elementFromPoint(x, y))
  ) {
    return undefined;
  }
  for (const row of list.querySelectorAll<HTMLElement>(ROW)) {
    const box = row.getBoundingClientRect();
    if (y < box.top + box.height / 2) return row.dataset['quickId'] ?? null;
  }
  return null;
}

export function useQuickDrag({
  enabled,
  revision,
  onMove,
}: {
  readonly enabled: boolean;
  readonly revision: number | null;
  readonly onMove: (id: string, before: string | null) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const ended = useRef(false);
  const aborted = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [seen, setSeen] = useState({enabled, revision});
  if (seen.enabled !== enabled || seen.revision !== revision) {
    setSeen({enabled, revision});
    if (drag !== null) {
      setDrag(null);
      setCancelled(true);
    }
  }
  const tracking = drag !== null;
  const move = useEffectEvent((event: globalThis.PointerEvent) => {
    if (
      aborted.current ||
      drag?.pointerId !== event.pointerId ||
      list.current === null
    ) {
      return;
    }
    if (
      !drag.started &&
      Math.hypot(event.clientX - drag.x, event.clientY - drag.y) <=
        DRAG_THRESHOLD_PX
    ) {
      return;
    }
    ended.current = true;
    setDrag({
      ...drag,
      started: true,
      before: beforeAt(list.current, event.clientX, event.clientY),
    });
  });
  const finish = useEffectEvent((event: globalThis.PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) return;
    setDrag(null);
    if (aborted.current) return;
    if (
      !drag.started &&
      !ended.current &&
      Math.hypot(event.clientX - drag.x, event.clientY - drag.y) <=
        DRAG_THRESHOLD_PX
    ) {
      return;
    }
    ended.current = true;
    if (list.current === null) return;
    const before = beforeAt(list.current, event.clientX, event.clientY);
    if (before === undefined) return;
    const rows = [...list.current.querySelectorAll<HTMLElement>(ROW)];
    const index = rows.findIndex(row => row.dataset['quickId'] === drag.id);
    const next = rows[index + 1]?.dataset['quickId'] ?? null;
    if (index >= 0 && before !== drag.id && before !== next) {
      onMove(drag.id, before);
    }
  });
  const cancel = useEffectEvent(() => {
    aborted.current = true;
    if (drag !== null) ended.current = true;
    setDrag(null);
  });
  const escape = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (
      event.key !== 'Escape' ||
      drag === null ||
      (!drag.started && !ended.current)
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    cancel();
  });
  useEffect(() => {
    if (!tracking) return undefined;
    const moving = (event: globalThis.PointerEvent): void => move(event);
    const up = (event: globalThis.PointerEvent): void => finish(event);
    const lost = (): void => cancel();
    const key = (event: globalThis.KeyboardEvent): void => escape(event);
    window.addEventListener('pointermove', moving);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', lost);
    window.addEventListener('blur', lost);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointermove', moving);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', lost);
      window.removeEventListener('blur', lost);
      window.removeEventListener('keydown', key, true);
    };
  }, [tracking]);
  return {
    before: drag?.started ? drag.before : undefined,
    listProps: {
      ref: list,
      onPointerDown: (event: PointerEvent<HTMLDivElement>): void => {
        aborted.current = false;
        ended.current = false;
        setCancelled(false);
        const row =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>(ROW)
            : null;
        const id = row?.dataset['quickId'];
        if (
          !enabled ||
          event.button !== 0 ||
          id === undefined ||
          !list.current?.contains(row)
        ) {
          return;
        }
        setDrag({
          id,
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          started: false,
          before: id,
        });
      },
      onClickCapture: (event: MouseEvent<HTMLDivElement>): void => {
        if (event.detail === 0 || (!ended.current && !cancelled)) return;
        ended.current = false;
        setCancelled(false);
        event.preventDefault();
        event.stopPropagation();
      },
    },
  };
}
