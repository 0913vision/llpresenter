import {
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type PointerEvent,
} from 'react';
import type {StageElement, StageLayout} from '@shared/schema/stageLayouts';
import {stageElementKinds} from '@shared/schema/stageLayouts';
import {Button} from '@renderer/ui';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import type {Notice} from '@renderer/ui/notices';
import {useLive} from '@renderer/state/live';
import {useSettingsDocument} from '../useSettingsDocument';
import {useScreensSelection} from '../selection';
import {useElementSize} from '../useElementSize';
import {fitAspect} from '../fitAspect';
import {
  editFrame,
  resizeHandles,
  type ElementFrame,
  type ResizeHandle,
} from './frameEdit';
import {elementNames, STAGE_ELEMENT_LIMIT} from './stageEditor';
import {useStageEditor} from './useStageEditor';
import {StagePicture} from './StagePicture';
import styles from './StageCanvas.module.css';

interface Gesture {
  readonly id: number;
  readonly elementId: string;
  readonly start: ElementFrame;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly handle: ResizeHandle | 'move';
  readonly target: HTMLElement;
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

/** Stage geometry editing; pointer drafts save once when the gesture completes. */
export function StageCanvas({
  onProblem,
}: {
  onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const document = useSettingsDocument('stage-layouts', '무대 배치', onProblem);
  const timers = useSettingsDocument('timers', '타이머', onProblem);
  const selection = useScreensSelection(view => view.selection);
  const live = useLive(view => view.state);
  const run = useStageEditor(document, onProblem);
  const layout =
    selection.kind === 'stage'
      ? document?.value.layouts.find(layout => layout.id === selection.id)
      : undefined;
  return layout === undefined ? null : (
    <CanvasBody
      key={layout.id}
      layout={layout}
      readOnly={document?.access !== 'editable'}
      run={run}
      live={live}
      timers={timers?.value.timers ?? []}
    />
  );
}

function CanvasBody({
  layout,
  readOnly,
  run,
  live,
  timers,
}: {
  layout: StageLayout;
  readOnly: boolean;
  run: ReturnType<typeof useStageEditor>;
  live: Parameters<typeof StagePicture>[0]['live'];
  timers: Parameters<typeof StagePicture>[0]['timers'];
}): JSX.Element {
  const picked = useScreensSelection(view => view.stageElement);
  const selectElement = useScreensSelection(view => view.selectStageElement);
  const selected = picked?.layoutId === layout.id ? picked.elementId : null;
  const select = (id: string | null): void => selectElement(layout.id, id);
  const [draft, setDraft] = useState<{
    id: string;
    frame: ElementFrame;
    pending?: boolean;
  } | null>(null);
  const [kind, setKind] = useState<StageElement['kind']>('currentSlide');
  const gesture = useRef<Gesture | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
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
  const size = fitAspect(
    available ?? {width: 0, height: 0},
    layout.width / layout.height,
  );
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
  if (draft?.pending) {
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
    run(
      editor => editor.frame(layout.id, current.elementId, current.frame),
      saved => {
        if (!saved && active.current && saveSequence.current === sequence) {
          setDraft(null);
        }
      },
    );
  };
  const start = (
    event: PointerEvent<HTMLButtonElement>,
    element: StageElement,
    handle: Gesture['handle'],
  ): void => {
    if (event.button !== 0 || readOnly || gesture.current !== null) return;
    const width = canvas.current?.getBoundingClientRect().width ?? 0;
    if (width <= 0) return;
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
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  return (
    <section className={styles.editor} aria-label="무대 배치 편집기">
      <header className={styles.toolbar}>
        <strong>
          {layout.name} {layout.width}×{layout.height}
        </strong>
        <SelectMenu
          size="sm"
          aria-label="추가할 요소"
          value={kind}
          disabled={readOnly}
          onChange={setKind}
          options={stageElementKinds.map(value => ({
            value,
            label: elementNames[value],
          }))}
        />
        <Button
          size="sm"
          disabled={readOnly || layout.elements.length >= STAGE_ELEMENT_LIMIT}
          onClick={() => {
            run(
              editor => editor.add(layout.id, kind),
              id => {
                if (active.current && id !== null) select(id);
              },
            );
          }}
        >
          요소 추가
        </Button>
      </header>
      <div ref={watchSpace} className={styles.space}>
        <div
          ref={canvas}
          className={styles.canvas}
          style={{width: size.width, height: size.height}}
          data-stage-canvas
          tabIndex={0}
          aria-label="무대 배치 캔버스"
          onPointerMove={event => {
            const current = gesture.current;
            if (current?.id !== event.pointerId) return;
            current.frame = editFrame(
              current.start,
              {
                x: (event.clientX - current.x) / current.scale,
                y: (event.clientY - current.y) / current.scale,
              },
              current.handle,
            );
            setDraft({id: current.elementId, frame: current.frame});
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
            if (event.key === 'Escape') {
              stop(false);
              return;
            }
            if (
              readOnly ||
              gesture.current !== null ||
              event.repeat ||
              event.ctrlKey ||
              event.altKey ||
              event.metaKey
            ) {
              return;
            }
            const element = layout.elements.find(
              element => element.id === selected,
            );
            if (element === undefined) return;
            if (event.key === 'Delete') {
              setDraft(null);
              event.preventDefault();
              run(editor => editor.remove(layout.id, element.id));
              select(null);
              return;
            }
            const step = event.shiftKey ? 10 : 1;
            const delta = {
              ArrowLeft: {x: -step, y: 0},
              ArrowRight: {x: step, y: 0},
              ArrowUp: {x: 0, y: -step},
              ArrowDown: {x: 0, y: step},
            };
            if (!(event.key in delta)) return;
            const direction = Object.entries(delta).find(
              ([key]) => key === event.key,
            )?.[1];
            if (direction !== undefined) {
              setDraft(null);
              event.preventDefault();
              run(editor => editor.nudge(layout.id, element.id, direction));
            }
          }}
        >
          <StagePicture layout={picture} live={live} timers={timers} />
          {picture.elements.map(element => (
            <div
              key={element.id}
              className={`${styles.element} ${selected === element.id ? styles.selected : ''}`}
              style={{
                left: `${(100 * element.frame.x) / layout.width}%`,
                top: `${(100 * element.frame.y) / layout.height}%`,
                width: `${(100 * element.frame.w) / layout.width}%`,
                height: `${(100 * element.frame.h) / layout.height}%`,
              }}
              data-stage-element={element.id}
            >
              <button
                className={styles.move}
                aria-label={element.name || elementNames[element.kind]}
                aria-pressed={selected === element.id}
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
    </section>
  );
}
