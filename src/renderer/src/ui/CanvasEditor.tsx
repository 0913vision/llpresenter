import {MIN_SIZE, resizeHandles, type ResizeHandle} from '@core/canvas';
import {useCommandShortcuts} from './commandDispatcher';
import {
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type PointerEvent,
  type ReactNode,
} from 'react';
import {useElementSize} from './useElementSize';
import {CanvasFrameBar} from './CanvasFrameBar';
import {CanvasGuides} from './CanvasGuides';
import {
  withDraft,
  type CanvasDocument,
  type CanvasElement,
} from './canvasDraft';
import {fitAspect, type ElementFrame} from '@core/canvas';
import {useCanvasGesture, type CanvasActions} from './useCanvasGesture';
import styles from './CanvasEditor.module.css';

export type {CanvasDocument, CanvasElement} from './canvasDraft';
export type {CanvasActions} from './useCanvasGesture';

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
  readonly resolvedFrames?: Readonly<Record<string, ElementFrame>> | undefined;
  readonly hitPriority?: Readonly<Record<string, number>> | undefined;
  readonly getElementLabel: (element: T) => string;
  readonly renderContent: (elements: readonly T[]) => ReactNode;
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

/** The arrow commands of the canvas and how far each moves, in pixels. */
const NUDGES: ReadonlyArray<readonly [string, number, number]> = [
  ['stageEditor.moveLeft', -1, 0],
  ['stageEditor.moveLeftLarge', -10, 0],
  ['stageEditor.moveRight', 1, 0],
  ['stageEditor.moveRightLarge', 10, 0],
  ['stageEditor.moveUp', 0, -1],
  ['stageEditor.moveUpLarge', 0, -10],
  ['stageEditor.moveDown', 0, 1],
  ['stageEditor.moveDownLarge', 0, 10],
];

/** Where a frame sits on the canvas, in percent of the layout. */
function placeOf(
  frame: Pick<ElementFrame, 'x' | 'y'> & Partial<Pick<ElementFrame, 'w' | 'h'>>,
  layout: {readonly width: number; readonly height: number},
): CSSProperties {
  return {
    left: `${(100 * frame.x) / layout.width}%`,
    top: `${(100 * frame.y) / layout.height}%`,
    ...(frame.w === undefined
      ? {}
      : {width: `${(100 * frame.w) / layout.width}%`}),
    ...(frame.h === undefined
      ? {}
      : {height: `${(100 * frame.h) / layout.height}%`}),
  };
}

/**
 * One element on the canvas: a button that picks and moves it, and the
 * resize handles of the chosen one.
 */
function CanvasElementBox({
  element,
  frame,
  layout,
  label,
  selected,
  inSelection,
  handles,
  priority,
  onChoose,
  onPress,
}: {
  readonly element: CanvasElement;
  readonly frame: ElementFrame;
  readonly layout: {readonly width: number; readonly height: number};
  readonly label: string;
  readonly selected: boolean;
  /** One of several chosen elements. */
  readonly inSelection: boolean;
  readonly handles: boolean;
  readonly priority: number | undefined;
  readonly onChoose: () => void;
  readonly onPress: (
    event: PointerEvent<HTMLButtonElement>,
    handle: 'move' | ResizeHandle,
  ) => void;
}): JSX.Element {
  return (
    <div
      className={`${styles.element} ${selected || inSelection ? styles.selected : ''}`}
      style={{...placeOf(frame, layout), zIndex: priority}}
      data-canvas-element={element.id}
    >
      <button
        className={styles.move}
        aria-label={label}
        aria-pressed={selected || inSelection}
        onClick={onChoose}
        onPointerDown={event => onPress(event, 'move')}
      />
      {handles
        ? resizeHandles.map(handle => (
            <button
              key={handle}
              className={styles.handle}
              data-handle={handle}
              aria-label={`${element.name} ${handleNames[handle]} 크기 조절`}
              onPointerDown={event => onPress(event, handle)}
            />
          ))
        : null}
    </div>
  );
}

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
  resolvedFrames,
  hitPriority,
  getElementLabel,
  renderContent,
}: CanvasEditorProps<T>): JSX.Element {
  const readOnly = readOnlyReason !== undefined;
  const [zoomFactor, setZoomFactor] = useState(1);
  const canvas = useRef<HTMLDivElement>(null);
  const {draft, clear, gesture, dragged, start, update, move, stop, type} =
    useCanvasGesture({
      layout,
      canvas,
      actions,
      readOnly,
      selectedIds,
      select,
      keepRatio,
      snapGrid,
    });
  const ownsCommand = (event: KeyboardEvent): boolean =>
    event.target instanceof Node &&
    canvas.current?.contains(event.target) === true &&
    !readOnly &&
    gesture.current === null;
  useCommandShortcuts([
    {
      id: 'edit.delete',
      context: 'canvas',
      when: ownsCommand,
      run: () => {
        if (selected === null) return;
        clear();
        actions.remove(selected);
        select(null);
      },
    },
    ...NUDGES.map(([id, x, y]) => ({
      id,
      context: 'canvas' as const,
      when: ownsCommand,
      run: () => {
        if (selected === null) return;
        clear();
        actions.nudge(selected, {x, y});
      },
    })),
  ]);

  // NOTE(0913vision): Measure outside the scroller so its bars and selection
  // handles cannot change the fit size.
  const [watchSpace, available] = useElementSize();
  const fitted = fitAspect(
    available ?? {width: 0, height: 0},
    layout.width / layout.height,
  );
  const size = {
    width: fitted.width * zoomFactor,
    height: fitted.height * zoomFactor,
  };
  const picture = withDraft(layout, draft);
  return (
    <section
      className={styles.editor}
      aria-label={`${label} 편집기`}
      data-canvas-editor
    >
      {toolbar}
      <div className={styles.viewport}>
        <div ref={watchSpace} className={styles.measure} aria-hidden="true" />
        <div
          className={`${styles.space} ${footer === 'zoom' ? styles.scrollable : ''}`}
        >
          <div
            ref={canvas}
            data-command-context="canvas"
            className={styles.canvas}
            style={{width: size.width, height: size.height}}
            data-canvas
            tabIndex={0}
            role="group"
            aria-label={`${label} 캔버스`}
            onPointerMove={move}
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
            {draft?.frames !== undefined && !draft.pending ? (
              <span
                className={styles.dragCount}
                aria-hidden="true"
                style={placeOf(draft.frame, layout)}
              >
                {draft.frames.length}
              </span>
            ) : null}
            {draft?.guides === undefined || selected !== draft.id ? null : (
              <CanvasGuides
                guides={draft.guides}
                width={layout.width}
                height={layout.height}
              />
            )}
            {picture.elements.map(element => (
              <CanvasElementBox
                key={element.id}
                element={element}
                frame={resolvedFrames?.[element.id] ?? element.frame}
                layout={layout}
                label={getElementLabel(element)}
                selected={selected === element.id}
                inSelection={selectedIds?.includes(element.id) === true}
                handles={selected === element.id && !readOnly}
                priority={hitPriority?.[element.id]}
                onChoose={() => {
                  if (!dragged.current) select(element.id);
                  dragged.current = false;
                }}
                onPress={(event, handle) => start(event, element, handle)}
              />
            ))}
          </div>
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
          if (element !== undefined) type(element, {field, value});
        }}
      />
    </section>
  );
}
