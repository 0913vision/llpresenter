import {
  containFrameGesture,
  frameWithinBounds,
  guideFrame,
  roundGeometryFrame,
  translateFrames,
  type ElementFrame,
  type GuideLines,
  type ResizeHandle,
  type SelectedFrame,
} from '@core/canvas';

export interface CanvasElement {
  readonly id: string;
  readonly name: string;
  readonly frame: ElementFrame;
}

export interface CanvasDocument<T extends CanvasElement> {
  readonly width: number;
  readonly height: number;
  readonly elements: readonly T[];
  readonly minimumSize?: number;
  readonly contained?: boolean;
}

/** The frames shown in place of the saved ones while they change. */
export interface CanvasDraft {
  readonly id: string;
  readonly frame: ElementFrame;
  /** Every frame of a group that moves together. */
  readonly frames?: readonly SelectedFrame[] | undefined;
  /** Sent to be saved; shown until the saved frame comes back. */
  readonly pending?: boolean;
  /** Typed in a field; the answer of the save replaces it. */
  readonly waiting?: boolean;
  readonly guides?: GuideLines;
}

/** A drag of an element or of one of its handles. */
export interface CanvasGesture {
  readonly members: readonly SelectedFrame[];
  readonly id: number;
  readonly elementId: string;
  readonly start: ElementFrame;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly handle: ResizeHandle | 'move';
  readonly target: HTMLElement;
  readonly keepRatio: boolean;
  readonly snapGrid: boolean;
  readonly distance: number;
  readonly targets: readonly ElementFrame[];
  readonly minimumSize: number;
  delta: {x: number; y: number};
  frame: ElementFrame;
}

export function sameFrame(a: ElementFrame, b: ElementFrame): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/** The document as it shows: the draft's frames over the saved ones. */
export function withDraft<T extends CanvasElement>(
  layout: CanvasDocument<T>,
  draft: CanvasDraft | null,
): CanvasDocument<T> {
  if (draft === null) return layout;
  return {
    ...layout,
    elements: layout.elements.map(element => {
      const member = draft.frames?.find(row => row.id === element.id);
      if (member !== undefined) return {...element, frame: member.frame};
      return element.id === draft.id
        ? {...element, frame: draft.frame}
        : element;
    }),
  };
}

/** The other members of a group, moved by as much as the dragged one. */
export function groupFrames(
  gesture: CanvasGesture,
  frame: ElementFrame,
  bounds: {readonly width: number; readonly height: number},
): readonly SelectedFrame[] | undefined {
  return gesture.members.length > 1
    ? translateFrames(
        gesture.members,
        {x: frame.x - gesture.start.x, y: frame.y - gesture.start.y},
        bounds,
      )
    : undefined;
}

/**
 * Where a drag puts the frame: snapped to the guides unless `bypass`, kept
 * inside a contained document, and rounded to whole pixels.
 */
export function gestureFrame(
  gesture: CanvasGesture,
  bypass: boolean,
  layout: CanvasDocument<CanvasElement>,
): {
  readonly frame: ElementFrame;
  readonly frames: readonly SelectedFrame[] | undefined;
  readonly guides: GuideLines;
} {
  const guided = guideFrame({...gesture, bypass});
  const contained = layout.contained
    ? containFrameGesture(guided.frame, {...gesture, bounds: layout})
    : guided.frame;
  const rounded = roundGeometryFrame(contained);
  const frame = layout.contained
    ? roundGeometryFrame(frameWithinBounds(rounded, layout))
    : rounded;
  return {
    frame,
    frames: groupFrames(gesture, frame, layout),
    guides: frame === guided.frame ? guided.guides : {},
  };
}
