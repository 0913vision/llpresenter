import {useMemo, type CSSProperties, type DragEvent, type JSX} from 'react';
import type {Screen} from '@shared/schema/screens';
import {MONITOR_SCREEN_ID_MAX} from '@shared/schema/monitors';
import {Button} from '@renderer/ui';
import {classNames} from '@renderer/ui/classNames';
import {sendLive} from '@renderer/state/live';
import type {Notice} from '@renderer/ui/notices';
import {displayLayout, type MonitorBox, type TargetBox} from './layoutBoxes';
import {fitAspect, type BoxSize} from './fitAspect';
import {selectedScreenIn, useScreensSelection} from './selection';
import {useElementSize} from './useElementSize';
import {useMonitors} from './useMonitors';
import {useSettingsDocument} from './useSettingsDocument';
import {useScreenEditor} from './useScreenEditor';
import {SCREEN_DRAG_MIME} from './screenDrag';
import styles from './DisplayLayout.module.css';

const TITLE = '배치';
const LOAD_TITLE = '화면';
const IDENTIFY_LABEL = '모니터 번호 표시';
const CONTROL_LABEL = '컨트롤';
const PERCENT_UNIT = '%';
const noScreens: readonly Screen[] = [];

function percent(value: number): string {
  return `${value}${PERCENT_UNIT}`;
}

function arrangementStyle(
  available: BoxSize | undefined,
  aspectRatio: number,
): CSSProperties {
  if (available === undefined) return {aspectRatio};
  const {width, height} = fitAspect(available, aspectRatio);
  return {width: `${width}px`, height: `${height}px`};
}

function MonitorView({
  box,
  onDrop,
  enabled,
}: {
  readonly box: MonitorBox;
  readonly onDrop: (event: DragEvent) => void;
  readonly enabled: boolean;
}): JSX.Element {
  return (
    <div
      className={classNames(styles.monitor, box.selected && styles.selected)}
      data-monitor={box.number}
      aria-current={box.selected ? 'true' : undefined}
      onDragOver={event => {
        if (
          !enabled ||
          box.control ||
          !event.dataTransfer.types.includes(SCREEN_DRAG_MIME)
        ) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={onDrop}
      style={{
        left: percent(box.left),
        top: percent(box.top),
        width: percent(box.width),
        height: percent(box.height),
      }}
    >
      <span className={styles.number}>{box.number}</span>
      {box.screens.length > 0 && (
        <span className={styles.screens}>{box.screens.join(', ')}</span>
      )}
      {box.control && <span className={styles.control}>{CONTROL_LABEL}</span>}
      <span>{box.resolution}</span>
      <span>{box.name}</span>
    </div>
  );
}

function TargetView({target}: {readonly target: TargetBox}): JSX.Element {
  return (
    <div
      className={classNames(styles.target, target.selected && styles.selected)}
      data-target={target.id}
      aria-current={target.selected ? 'true' : undefined}
    >
      <span className={styles.targetName}>{target.name}</span>
      {target.resolution !== undefined && <span>{target.resolution}</span>}
    </div>
  );
}

/**
 * The display layout: one box per monitor placed like the Windows
 * arrangement, with the screens that show on it, and the screens without a
 * monitor apart. 모니터 번호 표시 shows the numbers on the real monitors.
 */
export function DisplayLayout({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const monitors = useMonitors();
  const document = useSettingsDocument('screens', LOAD_TITLE, onProblem);
  const editor = useScreenEditor(document, onProblem);
  const selection = useScreensSelection(view => view.selection);
  const screens = document?.value.screens ?? noScreens;
  const selectedId = selectedScreenIn(selection, screens)?.id;
  const select = useScreensSelection(view => view.select);
  const [watchStage, stageSize] = useElementSize();
  const model = useMemo(
    () => displayLayout(monitors, screens, selectedId),
    [monitors, screens, selectedId],
  );
  return (
    <section className={styles.layout} aria-label={TITLE}>
      <div className={styles.header}>
        <Button
          icon="monitor"
          onClick={() => sendLive({type: 'monitors.identify'})}
        >
          {IDENTIFY_LABEL}
        </Button>
      </div>
      <div className={styles.stage} ref={watchStage}>
        <div
          className={styles.arrangement}
          style={arrangementStyle(stageSize, model.aspectRatio)}
        >
          {model.monitors.map(box => (
            <MonitorView
              key={box.number}
              box={box}
              enabled={
                document?.access === 'editable' &&
                monitors.some(
                  monitor =>
                    monitor.number === box.number && monitor.id !== undefined,
                )
              }
              onDrop={event => {
                if (document?.access !== 'editable') return;
                const monitor = monitors.find(
                  item => item.number === box.number,
                );
                if (
                  monitor === undefined ||
                  monitor.hasMainWindow ||
                  monitor.id === undefined ||
                  !event.dataTransfer.types.includes(SCREEN_DRAG_MIME)
                )
                  {return;}
                const screenId = event.dataTransfer.getData(SCREEN_DRAG_MIME);
                if (
                  screenId.length > MONITOR_SCREEN_ID_MAX ||
                  !screens.some(screen => screen.id === screenId)
                )
                  {return;}
                event.preventDefault();
                select('screen', screenId);
                editor.assign(screenId, monitor);
              }}
            />
          ))}
        </div>
      </div>
      {model.targets.length > 0 && (
        <div className={styles.targets}>
          {model.targets.map(target => (
            <TargetView key={target.id} target={target} />
          ))}
        </div>
      )}
    </section>
  );
}
