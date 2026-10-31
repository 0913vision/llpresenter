import {useCommandShortcuts} from './commandDispatcher';
import {
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type PointerEvent,
  type ReactNode,
} from 'react';
import {
  editFrameValue,
  containFrameGesture,
  MIN_SIZE,
  resizeHandles,
  type ElementFrame,
  type FrameFieldChange,
  type ResizeHandle,
} from '@core/canvas/frameEdit';
import {fitAspect} from '@core/canvas/fitAspect';
import {guideFrame, type GuideLines} from '@core/canvas/smartGuides';
import {useElementSize} from './useElementSize';
import {CanvasFrameBar} from './CanvasFrameBar';
import styles from './CanvasEditor.module.css';

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
export interface CanvasActions {
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
export interface CanvasEditorProps<T extends CanvasElement> {
  readonly value: CanvasDocument<T>;
  readonly label: string;
  readonly selected: string | null;
  readonly selectedIds?: readonly string[];
  readonly footer?: 'frames' | 'zoom';
  readonly onSelect: (id: string | null) => void;
  readonly readOnlyReason: string | undefined;
  readonly actions: CanvasActions;
  readonly keepRatio: boolean;
  readonly setKeepRatio: (value: boolean) => void;
  readonly snapGrid: boolean;
  readonly setSnapGrid: (value: boolean) => void;
  readonly toolbar?: ReactNode;
  readonly getElementLabel: (element: T) => string;
  readonly renderContent: (elements: readonly T[]) => ReactNode;
}

interface Gesture {
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
const handleNames: Readonly<Record<ResizeHandle, string>> = {
  nw: '왼쪽 위',
  n: '위',
  ne: '오른쪽 위',
  e: '오른쪽',
  se: '오른쪽 아래',
  s: '아래',
  sw: '왼쪽 아래',
  w: '왼쪽',
};

/** Edits frames in reference pixels while the caller renders content and owns saves. */
export function CanvasEditor<T extends CanvasElement>({
  value: layout,
  label,
  selected,
  selectedIds,
  footer = 'frames',
  onSelect: select,
  readOnlyReason,
  actions,
  keepRatio,
  setKeepRatio,
  snapGrid,
  setSnapGrid,
  toolbar,
  getElementLabel,
  renderContent,
}: CanvasEditorProps<T>): JSX.Element {
  const readOnly = readOnlyReason !== undefined;
  const [zoomFactor, setZoomFactor] = useState(1);
  const [draft, setDraft] = useState<{
    id: string;
    frame: ElementFrame;
    pending?: boolean;
    waiting?: boolean;
    guides?: GuideLines;
  } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const ownsCommand = (event: KeyboardEvent): boolean =>
    event.target instanceof Node &&
    canvas.current?.contains(event.target) === true &&
    !readOnly &&
    gesture.current === null;
  const nudge = (x: number, y: number): void => {
    if (selected === null) return;
    setDraft(null);
    actions.nudge(selected, {x, y});
  };
  useCommandShortcuts([
    {
      id: 'edit.delete',
      context: 'canvas',
      when: ownsCommand,
      run: () => {
        if (selected === null) return;
        setDraft(null);
        actions.remove(selected);
        select(null);
      },
    },
    {
      id: 'stageEditor.moveLeft',
      context: 'canvas',
      when: ownsCommand,
      run: () => nudge(-1, 0),
    },
    {
      id: 'stageEditor.moveLeftLarge',
      context: 'canvas',
      when: ownsCommand,
      run: () => nudge(-10, 0),
    },
    {
      id: 'stageEditor.moveRight',
      context: 'canvas',
      when: ownsCommand,
      run: () => nudge(1, 0),
    },
    {
      id: 'stageEditor.moveRightLarge',
      context: 'canvas',
      when: ownsCommand,
      run: () => nudge(10, 0),
    },
    {
      id: 'stageEditor.moveUp',
      context: 'canvas',
      when: ownsCommand,
      run: () => nudge(0, -1),
    },
    {
      id: 'stageEditor.moveUpLarge',
      context: 'canvas',
      when: ownsCommand,
      run: () => nudge(0, -10),
    },
    {
      id: 'stageEditor.moveDown',
      context: 'canvas',
      when: ownsCommand,
      run: () => nudge(0, 1),
    },
    {
      id: 'stageEditor.moveDownLarge',
      context: 'canvas',
      when: ownsCommand,
      run: () => nudge(0, 10),
    },
  ]);

  const active = useRef(true);
  const saveSequence = useRef(0);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      gesture.current = null;
    };
  }, []);
  const [watchSpace, available] = useElementSize();
  const fitted = fitAspect(
    available ?? {width: 0, height: 0},
    layout.width / layout.height,
  );
  const size = {
    width: fitted.width * zoomFactor,
    height: fitted.height * zoomFactor,
  };
  const picture =
    draft === null
      ? layout
      : {
          ...layout,
          elements: layout.elements.map(element =>
            element.id === draft.id
              ? {...element, frame: draft.frame}
              : element,
          ),
        };
  if (draft?.pending && !draft.waiting) {
    const frame = layout.elements.find(
      element => element.id === draft.id,
    )?.frame;
    if (
      frame?.x === draft.frame.x &&
      frame.y === draft.frame.y &&
      frame.w === draft.frame.w &&
      frame.h === draft.frame.h
    ) {
      setDraft(null);
    }
  }
  const stop = (commit: boolean): void => {
    const current = gesture.current;
    gesture.current = null;
    if (current === null) return;
    if (current.target.hasPointerCapture(current.id)) {
      current.target.releasePointerCapture(current.id);
    }
    if (!commit) {
      setDraft(null);
      return;
    }
    if (
      current.frame.x === current.start.x &&
      current.frame.y === current.start.y &&
      current.frame.w === current.start.w &&
      current.frame.h === current.start.h
    ) {
      setDraft(null);
      return;
    }
    const sequence = ++saveSequence.current;
    setDraft({id: current.elementId, frame: current.frame, pending: true});
    actions.frame(current.elementId, current.frame, saved => {
      if (!saved && active.current && saveSequence.current === sequence) {
        setDraft(null);
      }
    });
  };
  const start = (
    event: PointerEvent<HTMLButtonElement>,
    element: T,
    handle: Gesture['handle'],
  ): void => {
    if (event.button !== 0 || readOnly || gesture.current !== null) return;
    const surface = canvas.current;
    const width = surface?.getBoundingClientRect().width ?? 0;
    if (surface === null || width <= 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    select(element.id);
    gesture.current = {
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
          .filter(item => item.id !== element.id)
          .map(item => item.frame),
      ],
      delta: {x: 0, y: 0},
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const update = (bypass: boolean): void => {
    const current = gesture.current;
    if (current === null) return;
    const guided = guideFrame({...current, bypass});
    const frame = layout.contained
      ? containFrameGesture(guided.frame, {...current, bounds: layout})
      : guided.frame;
    const guides = frame === guided.frame ? guided.guides : {};
    current.frame = frame;
    setDraft({id: current.elementId, frame, guides});
  };
  return (
    <section
      className={styles.editor}
      aria-label={`${label} 편집기`}
      data-canvas-editor
    >
      {toolbar}
      <div
        ref={watchSpace}
        className={`${styles.space} ${footer === 'zoom' ? styles.scrollable : ''}`}
      >
        <div
          ref={canvas}
          data-command-context="canvas"
          className={styles.canvas}
          style={{width: size.width, height: size.height}}
          data-canvas
          tabIndex={0}
          aria-label={`${label} 캔버스`}
          onPointerMove={event => {
            const current = gesture.current;
            if (current?.id !== event.pointerId) return;
            current.delta = {
              x: (event.clientX - current.x) / current.scale,
              y: (event.clientY - current.y) / current.scale,
            };
            update(event.altKey);
          }}
          onPointerUp={event => {
            if (gesture.current?.id === event.pointerId) stop(true);
          }}
          onPointerCancel={() => stop(false)}
          onLostPointerCapture={event => {
            if (
              event.target === gesture.current?.target &&
              event.pointerId === gesture.current.id &&
              event.buttons === 0 &&
              !gesture.current.target.hasPointerCapture(event.pointerId)
            ) {
              stop(true);
            }
          }}
          onPointerLeave={event => {
            const current = gesture.current;
            if (
              current?.id === event.pointerId &&
              !current.target.hasPointerCapture(current.id)
            ) {
              stop(false);
            }
          }}
          onBlur={event => {
            if (
              !(event.relatedTarget instanceof Node) ||
              !event.currentTarget.contains(event.relatedTarget)
            ) {
              stop(false);
            }
          }}
          onPointerDown={event => {
            if (event.target === event.currentTarget) {
              event.currentTarget.focus();
              select(null);
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Alt' && gesture.current !== null) {
              event.preventDefault();
              update(true);
              return;
            }
            if (event.key === 'Escape') {
              stop(false);
              return;
            }
          }}
          onKeyUp={event => {
            if (event.key === 'Alt' && gesture.current !== null) {
              event.preventDefault();
              update(false);
            }
          }}
        >
          {renderContent(picture.elements)}
          {draft?.guides === undefined || selected !== draft.id ? null : (
            <div className={styles.guides} aria-hidden="true">
              {draft.guides.x === undefined ||
              draft.guides.x < 0 ||
              draft.guides.x > layout.width ? null : (
                <span
                  className={styles.guideX}
                  data-canvas-guide="x"
                  style={{
                    left: `min(${(100 * draft.guides.x) / layout.width}%, calc(100% - var(--size-guide-line)))`,
                  }}
                />
              )}
              {draft.guides.y === undefined ||
              draft.guides.y < 0 ||
              draft.guides.y > layout.height ? null : (
                <span
                  className={styles.guideY}
                  data-canvas-guide="y"
                  style={{
                    top: `min(${(100 * draft.guides.y) / layout.height}%, calc(100% - var(--size-guide-line)))`,
                  }}
                />
              )}
            </div>
          )}
          {picture.elements.map(element => (
            <div
              key={element.id}
              className={`${styles.element} ${selected === element.id || selectedIds?.includes(element.id) ? styles.selected : ''}`}
              style={{
                left: `${(100 * element.frame.x) / layout.width}%`,
                top: `${(100 * element.frame.y) / layout.height}%`,
                width: `${(100 * element.frame.w) / layout.width}%`,
                height: `${(100 * element.frame.h) / layout.height}%`,
              }}
              data-canvas-element={element.id}
            >
              <button
                className={styles.move}
                aria-label={getElementLabel(element)}
                aria-pressed={
                  selected === element.id ||
                  selectedIds?.includes(element.id) === true
                }
                onClick={() => select(element.id)}
                onPointerDown={event => start(event, element, 'move')}
              />
              {selected !== element.id || readOnly
                ? null
                : resizeHandles.map(handle => (
                    <button
                      key={handle}
                      className={styles.handle}
                      data-handle={handle}
                      aria-label={`${element.name} ${handleNames[handle]} 크기 조절`}
                      onPointerDown={event => start(event, element, handle)}
                    />
                  ))}
            </div>
          ))}
        </div>
      </div>
      <CanvasFrameBar
        frame={picture.elements.find(element => element.id === selected)?.frame}
        width={layout.width}
        height={layout.height}
        zoom={size.width / layout.width}
        minimumSize={layout.minimumSize ?? MIN_SIZE}
        showFields={footer === 'frames'}
        zoomControl={
          footer === 'zoom'
            ? {value: zoomFactor, change: setZoomFactor}
            : undefined
        }
        readOnlyReason={readOnlyReason}
        keepRatio={keepRatio}
        setKeepRatio={setKeepRatio}
        snapGrid={snapGrid}
        setSnapGrid={setSnapGrid}
        change={(field, value) => {
          const element = picture.elements.find(
            element => element.id === selected,
          );
          if (element === undefined || readOnly || gesture.current !== null) {
            return;
          }
          const sequence = ++saveSequence.current;
          setDraft({
            id: element.id,
            frame: editFrameValue(
              element.frame,
              {field, value, keepRatio},
              layout,
            ),
            waiting: true,
            pending: true,
          });
          actions.frameValue(element.id, {field, value, keepRatio}, frame => {
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
        }}
      />
    </section>
  );
}
