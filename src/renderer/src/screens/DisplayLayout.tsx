import {
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
  type JSX,
} from 'react';
import type {Screen} from '@core/schema/screens';
import {MONITOR_SCREEN_ID_MAX, type MonitorList} from '@core/schema/monitors';
import {Button} from '@renderer/ui';
import {classNames} from '@renderer/ui/classNames';
import {sendLive} from '@renderer/platform/live';
import type {Notice} from '@renderer/ui/notices';
import {
  displayLayout,
  type DisplayLayoutModel,
  type MonitorBox,
} from './layoutBoxes';
import {fitAspect, type BoxSize} from './fitAspect';
import {
  useScreenView,
  useScreensSelection,
  type ScreensSelection,
} from './selection';
import {useElementSize} from './useElementSize';
import {useMonitors} from './useMonitors';
import {useSettingsDocument} from '../platform/useSettingsDocument';
import {useScreenEditor} from './useScreenEditor';
import {SCREEN_DRAG_MIME} from './screenDrag';
import styles from './DisplayLayout.module.css';
import {DisplayTarget} from './DisplayTarget';

const TITLE = '배치';
const LOAD_TITLE = '화면';
const IDENTIFY_LABEL = '모니터 번호 표시';
const CONTROL_LABEL = '컨트롤';
const PERCENT_UNIT = '%';
const MIN_MONITOR_WIDTH_ROWS = 6;
const MIN_MONITOR_HEIGHT_ROWS = 4;
const noScreens: readonly Screen[] = [];

function percent(value: number): string {
  return `${value}${PERCENT_UNIT}`;
}

function arrangementStyle(
  available: BoxSize | undefined,
  model: DisplayLayoutModel,
): CSSProperties {
  const {aspectRatio, monitors} = model;
  const minimumWidth = Math.max(
    ...monitors.map(box =>
      Math.max(
        (MIN_MONITOR_WIDTH_ROWS * 100) / box.width,
        ((MIN_MONITOR_HEIGHT_ROWS * 100) / box.height) * aspectRatio,
      ),
    ),
  );
  return {
    width:
      available === undefined
        ? '100%'
        : `${fitAspect(available, aspectRatio).width}px`,
    minWidth: `calc(var(--size-row) * ${minimumWidth})`,
    aspectRatio,
  };
}

function MonitorView({
  box,
  onDrop,
  enabled,
  onSelect,
}: {
  readonly box: MonitorBox;
  readonly onDrop: (event: DragEvent) => void;
  readonly enabled: boolean;
  readonly onSelect: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={`모니터 ${box.number} ${box.name}`}
      aria-pressed={box.selected}
      onClick={onSelect}
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
      {box.screens.length === 0 && <span>연결된 화면 없음</span>}
      {box.control && <span className={styles.control}>{CONTROL_LABEL}</span>}
      <span>{box.resolution}</span>
      <span>{box.name}</span>
    </button>
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
  const selectedId = useScreenView(screens)?.id;
  const select = useScreensSelection(view => view.select);
  const [pickedMonitor, setPickedMonitor] = useState<{
    number: number;
    selection: ScreensSelection;
    monitors: MonitorList;
  } | null>(null);
  const [watchStage, stageSize] = useElementSize();
  const model = useMemo(
    () => displayLayout(monitors, screens, selectedId),
    [monitors, screens, selectedId],
  );
  const pickedNumber =
    pickedMonitor?.selection === selection &&
    pickedMonitor.monitors === monitors
      ? pickedMonitor.number
      : null;
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
        {model.monitors.length === 0 ? (
          <span className={styles.empty}>연결된 모니터 없음</span>
        ) : (
          <div
            className={styles.arrangement}
            style={arrangementStyle(stageSize, model)}
          >
            {model.monitors.map(box => (
              <MonitorView
                key={box.number}
                box={{
                  ...box,
                  selected:
                    pickedNumber === null
                      ? box.selected
                      : pickedNumber === box.number,
                }}
                onSelect={() => {
                  const screenId = box.screenIds.includes(selectedId ?? '')
                    ? selectedId
                    : box.screenIds[0];
                  if (screenId !== undefined) select('screen', screenId);
                  setPickedMonitor({
                    number: box.number,
                    selection: useScreensSelection.getState().selection,
                    monitors,
                  });
                }}
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
                  ) {
                    return;
                  }
                  const screenId = event.dataTransfer.getData(SCREEN_DRAG_MIME);
                  if (
                    screenId.length > MONITOR_SCREEN_ID_MAX ||
                    !screens.some(screen => screen.id === screenId)
                  ) {
                    return;
                  }
                  event.preventDefault();
                  select('screen', screenId);
                  editor.assign(screenId, monitor);
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div
        className={styles.targetGroup}
        role="group"
        aria-label="별도 창 및 미지정 화면"
      >
        <span className={styles.groupTitle}>별도 창 및 미지정 화면</span>
        {model.targets.length > 0 ? (
          <div className={styles.targets}>
            {model.targets.map(target => (
              <DisplayTarget
                key={target.id}
                {...target}
                selected={pickedNumber === null && target.selected}
              />
            ))}
          </div>
        ) : (
          <span className={styles.empty}>
            {screens.length === 0 ? '등록된 화면 없음' : '없음'}
          </span>
        )}
      </div>
    </section>
  );
}
