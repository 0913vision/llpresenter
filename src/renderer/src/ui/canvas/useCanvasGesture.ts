import {useLayoutEffect, useRef, useState, type PointerEvent} from 'react';
import {
  editFrameValue,
  MIN_SIZE,
  type ElementFrame,
  type FrameFieldChange,
  type SelectedFrame,
} from '@core/canvas';
import {
  gestureFrame,
  groupFrames,
  sameFrame,
  type CanvasDocument,
  type CanvasDraft,
  type CanvasElement,
  type CanvasGesture,
} from './canvasDraft';

/** How the canvas saves frames; the owner answers whether each save held. */
export interface CanvasActions {
  readonly frames?: (
    values: readonly SelectedFrame[],
    completed: (saved: boolean) => void,
  ) => void;
  readonly frame: (
    id: string,
    frame: ElementFrame,
    completed: (saved: boolean) => void,
  ) => void;
  readonly frameValue: (
    id: string,
    change: FrameFieldChange,
    completed: (frame: ElementFrame | null) => void,
  ) => void;
  readonly nudge: (id: string, delta: {x: number; y: number}) => void;
  readonly remove: (id: string) => void;
}

/**
 * The drags and typed values that change frames on a canvas: the draft they
 * show until the save comes back, and the save itself.
 */
export function useCanvasGesture<T extends CanvasElement>({
  layout,
  canvas,
  actions,
  readOnly,
  selectedIds,
  select,
  keepRatio,
  snapGrid,
}: {
  readonly layout: CanvasDocument<T>;
  readonly canvas: {readonly current: HTMLElement | null};
  readonly actions: CanvasActions;
  readonly readOnly: boolean;
  readonly selectedIds: readonly string[] | undefined;
  readonly select: (id: string | null) => void;
  readonly keepRatio: boolean;
  readonly snapGrid: boolean;
}) {
  const [draft, setDraft] = useState<CanvasDraft | null>(null);
  const gesture = useRef<CanvasGesture | null>(null);
  const active = useRef(true);
  /** Whether the last press moved something, so its click selects nothing. */
  const dragged = useRef(false);
  const saveSequence = useRef(0);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      gesture.current = null;
    };
  }, []);
  if (draft?.pending && !draft.waiting) {
    const frame = layout.elements.find(
      element => element.id === draft.id,
    )?.frame;
    if (frame !== undefined && sameFrame(frame, draft.frame)) setDraft(null);
  }

  const stop = (commit: boolean): void => {
    const current = gesture.current;
    gesture.current = null;
    if (current === null) return;
    if (current.target.hasPointerCapture(current.id)) {
      current.target.releasePointerCapture(current.id);
    }
    if (!commit || sameFrame(current.frame, current.start)) {
      setDraft(null);
      return;
    }
    const sequence = ++saveSequence.current;
    dragged.current = true;
    const frames = groupFrames(current, current.frame, layout);
    setDraft({
      id: current.elementId,
      frame: current.frame,
      pending: true,
      frames,
    });
    const completed = (saved: boolean): void => {
      if (!saved && active.current && saveSequence.current === sequence) {
        setDraft(null);
      }
    };
    if (frames !== undefined && actions.frames !== undefined) {
      actions.frames(frames, completed);
    } else actions.frame(current.elementId, current.frame, completed);
  };

  const start = (
    event: PointerEvent<HTMLButtonElement>,
    element: T,
    handle: CanvasGesture['handle'],
  ): void => {
    if (event.button !== 0 || readOnly || gesture.current !== null) return;
    dragged.current = false;
    const surface = canvas.current;
    const width = surface?.getBoundingClientRect().width ?? 0;
    if (surface === null || width <= 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    const group =
      handle === 'move' &&
      actions.frames !== undefined &&
      selectedIds?.includes(element.id);
    if (!group) select(element.id);
    const members = group
      ? layout.elements.filter(row => selectedIds?.includes(row.id))
      : [element];
    gesture.current = {
      members,
      id: event.pointerId,
      elementId: element.id,
      start: element.frame,
      frame: element.frame,
      x: event.clientX,
      y: event.clientY,
      scale: width / layout.width,
      handle,
      target: event.currentTarget,
      keepRatio,
      snapGrid,
      minimumSize: layout.minimumSize ?? MIN_SIZE,
      distance: Number.parseFloat(
        getComputedStyle(surface).getPropertyValue('--size-guide-snap'),
      ),
      targets: [
        {x: 0, y: 0, w: layout.width, h: layout.height},
        ...layout.elements
          .filter(item => !members.some(member => member.id === item.id))
          .map(item => item.frame),
      ],
      delta: {x: 0, y: 0},
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  /** Draws the drag again, with the guides off while `bypass` (Alt). */
  const update = (bypass: boolean): void => {
    const current = gesture.current;
    if (current === null) return;
    if (current.delta.x === 0 && current.delta.y === 0) {
      current.frame = current.start;
      setDraft({id: current.elementId, frame: current.start, guides: {}});
      return;
    }
    const {frame, frames, guides} = gestureFrame(current, bypass, layout);
    current.frame =
      frames?.find(row => row.id === current.elementId)?.frame ?? frame;
    setDraft({id: current.elementId, frame: current.frame, frames, guides});
  };

  const move = (event: PointerEvent<HTMLElement>): void => {
    const current = gesture.current;
    if (current?.id !== event.pointerId) return;
    current.delta = {
      x: (event.clientX - current.x) / current.scale,
      y: (event.clientY - current.y) / current.scale,
    };
    update(event.altKey);
  };

  /** Saves a value typed in the frame bar of the selected element. */
  const type = (
    element: T,
    change: Omit<FrameFieldChange, 'keepRatio'>,
  ): void => {
    if (readOnly || gesture.current !== null) return;
    const full = {...change, keepRatio};
    const sequence = ++saveSequence.current;
    setDraft({
      id: element.id,
      frame: editFrameValue(element.frame, full, layout),
      waiting: true,
      pending: true,
    });
    actions.frameValue(element.id, full, frame => {
      if (active.current && saveSequence.current === sequence) {
        setDraft(current =>
          current?.id !== element.id
            ? current
            : frame === null
              ? null
              : {id: element.id, frame, pending: true},
        );
      }
    });
  };

  return {
    draft,
    /** Drops the draft when a command changes the frame another way. */
    clear: () => setDraft(null),
    gesture,
    dragged,
    start,
    update,
    move,
    stop,
    type,
  };
}
