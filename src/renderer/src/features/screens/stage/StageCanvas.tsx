import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import {
  stageElementKinds,
  type StageElement,
  type StageLayout,
} from '@core/schema/stageLayouts';
import {Button} from '@renderer/ui/Button';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {CanvasEditor} from '@renderer/ui/CanvasEditor';
import type {Notice} from '@renderer/ui/notices';
import {useLive} from '@renderer/session/live';
import {useSettingsDocument} from '../../../platform/useSettingsDocument';
import {useScreensSelection} from '../selection';
import {elementNames, STAGE_ELEMENT_LIMIT} from './stageEditor';
import {useStageEditor} from './useStageEditor';
import {StagePicture} from './StagePicture';
import {STAGE_READ_ONLY} from './StageTextProperties';
import styles from './StageCanvas.module.css';

/** Adapts the shared frame canvas to stage selection, rendering, and queued writes. */
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
  const [keepRatio, setKeepRatio] = useState(false);
  const [snapGrid, setSnapGrid] = useState(false);
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
      keepRatio={keepRatio}
      setKeepRatio={setKeepRatio}
      snapGrid={snapGrid}
      setSnapGrid={setSnapGrid}
    />
  );
}

function CanvasBody({
  layout,
  readOnly,
  run,
  live,
  timers,
  keepRatio,
  setKeepRatio,
  snapGrid,
  setSnapGrid,
}: {
  layout: StageLayout;
  readOnly: boolean;
  run: ReturnType<typeof useStageEditor>;
  live: Parameters<typeof StagePicture>[0]['live'];
  timers: Parameters<typeof StagePicture>[0]['timers'];
  keepRatio: boolean;
  setKeepRatio: (value: boolean) => void;
  snapGrid: boolean;
  setSnapGrid: (value: boolean) => void;
}): JSX.Element {
  const picked = useScreensSelection(view => view.stageElement);
  const selectElement = useScreensSelection(view => view.selectStageElement);
  const selected = picked?.layoutId === layout.id ? picked.elementId : null;
  const select = (id: string | null): void => selectElement(layout.id, id);
  const [kind, setKind] = useState<StageElement['kind']>('currentSlide');
  const active = useRef(true);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <CanvasEditor
      value={layout}
      label="무대 배치"
      selected={selected}
      onSelect={select}
      readOnlyReason={readOnly ? STAGE_READ_ONLY : undefined}
      keepRatio={keepRatio}
      setKeepRatio={setKeepRatio}
      snapGrid={snapGrid}
      setSnapGrid={setSnapGrid}
      getElementLabel={element => element.name || elementNames[element.kind]}
      renderContent={elements => (
        <StagePicture
          layout={elements === layout.elements ? layout : {...layout, elements}}
          live={live}
          timers={timers}
        />
      )}
      actions={{
        frame: (id, frame, completed) =>
          run(editor => editor.frame(layout.id, id, frame), completed),
        frameValue: (id, change, completed) =>
          run(editor => editor.frameValue(layout.id, id, change), completed),
        nudge: (id, delta) => run(editor => editor.nudge(layout.id, id, delta)),
        remove: id => run(editor => editor.remove(layout.id, id)),
      }}
      toolbar={
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
      }
    />
  );
}
