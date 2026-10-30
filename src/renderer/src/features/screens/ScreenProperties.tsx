import {useMemo, useState, type JSX} from 'react';
import type {MonitorInfo, MonitorList} from '@core/schema/monitors';
import type {Screen} from '@core/schema/screens';
import {
  NumberField,
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
  SegmentedControl,
  SelectMenu,
  Switch,
  TextField,
} from '@renderer/ui';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {monitorPixelSize, sizeText, targetSize} from './displaySizes';
import {monitorAssignment} from '@core/screens/monitorAssignment';
import {
  CAPTURE_RESOLUTIONS,
  EDGE_MARGIN_MAX,
  OFFSET_LIMIT,
  alwaysOnTopOf,
  nameProblem,
  onDisconnectOf,
  type ScreenChange,
} from '@core/screens/screenEdits';
import {useScreenView, useScreensSelection} from './selection';
import {useMonitors} from './useMonitors';
import {useScreenEditor} from './useScreenEditor';
import {useSettingsDocument} from '../../platform/useSettingsDocument';
import {ScreenDeviceRow} from './ScreenDeviceRow';
import styles from './ScreenProperties.module.css';

const LOAD_TITLE = '화면';
const noScreens: readonly Screen[] = [];
const NDI_UNAVAILABLE = '이번 버전에서는 사용할 수 없음';
const READ_ONLY_REASON = '새 버전에서 만든 설정이므로 변경할 수 없음';
const NAME_PROBLEMS = {
  empty: '이름이 비어 있음',
  taken: '같은 이름의 화면이 있음',
} as const;

const KIND_OPTIONS = [
  {value: 'audience', label: '청중'},
  {value: 'stage', label: '무대'},
] as const;
const METHOD_OPTIONS = [
  {value: 'fullscreen', label: '전체 화면'},
  {value: 'window', label: '창'},
  {value: 'capture', label: '캡처용 창'},
  {value: 'ndi', label: 'NDI', disabled: true, title: NDI_UNAVAILABLE},
] as const;
const DISCONNECT_OPTIONS = [
  {value: 'window', label: '창으로 바꾸기'},
  {value: 'off', label: '출력 끄기'},
] as const;

type Change = (change: ScreenChange) => void;

function NameRow({
  screen,
  screens,
  rename,
  reason,
}: {
  readonly screen: Screen;
  readonly screens: readonly Screen[];
  readonly rename: (name: string) => void;
  readonly reason: string | undefined;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? screen.name;
  const problem = nameProblem(shown, screens, screen.id);
  const commit = (): void => {
    if (reason === undefined && problem === undefined && draft !== null) {
      rename(shown.trim());
    }
    setDraft(null);
  };
  return (
    <PropertyRow label="이름">
      {({controlId}) => (
        <TextField
          id={controlId}
          readOnly={reason !== undefined}
          aria-disabled={reason !== undefined ? true : undefined}
          title={reason}
          block
          value={shown}
          onChange={setDraft}
          onBlur={commit}
          onKeyDown={event => {
            if (
              event.key === 'Enter' &&
              !isComposing(event) &&
              !hasModifier(event)
            ) {
              event.currentTarget.blur();
            }
          }}
          invalid={problem !== undefined}
          invalidReason={
            problem === undefined ? undefined : NAME_PROBLEMS[problem]
          }
        />
      )}
    </PropertyRow>
  );
}

function ResolutionRow({
  screen,
  monitor,
  change,
  reason,
}: {
  readonly screen: Screen;
  readonly monitor: MonitorInfo | undefined;
  readonly change: Change;
  readonly reason: string | undefined;
}): JSX.Element | null {
  if (screen.method === 'capture') {
    const current = targetSize(screen);
    return (
      <PropertyRow label="해상도">
        {({controlId}) => (
          <SelectMenu
            id={controlId}
            disabled={reason !== undefined}
            title={reason}
            block
            menuLabel="해상도"
            options={CAPTURE_RESOLUTIONS.map(size => ({
              value: sizeText(size),
              label: sizeText(size),
            }))}
            value={current === undefined ? undefined : sizeText(current)}
            onChange={value => {
              const size = CAPTURE_RESOLUTIONS.find(
                candidate => sizeText(candidate) === value,
              );
              if (size !== undefined) change({resolution: size});
            }}
          />
        )}
      </PropertyRow>
    );
  }
  if (screen.method !== 'fullscreen' || monitor === undefined) return null;
  return (
    <PropertyValue label="해상도" value={sizeText(monitorPixelSize(monitor))} />
  );
}

function CorrectionRows({
  screen,
  change,
  reason,
}: {
  readonly screen: Screen;
  readonly change: Change;
  readonly reason: string | undefined;
}): JSX.Element {
  const offset = screen.offset ?? {x: 0, y: 0};
  return (
    <PropertyGroup title="보정">
      <PropertyRow label="가장자리 여백">
        {({controlId}) => (
          <NumberField
            id={controlId}
            readOnly={reason !== undefined}
            aria-disabled={reason !== undefined ? true : undefined}
            title={reason}
            value={screen.edgeMargin ?? 0}
            min={0}
            max={EDGE_MARGIN_MAX}
            suffix="%"
            updateOn="commit"
            onChange={edgeMargin => change({edgeMargin})}
          />
        )}
      </PropertyRow>
      <PropertyRow label="위치 미세 조정">
        {({controlId}) => (
          <span className={styles.pair}>
            <NumberField
              id={controlId}
              readOnly={reason !== undefined}
              aria-disabled={reason !== undefined ? true : undefined}
              title={reason}
              aria-label="가로 위치"
              value={offset.x}
              min={-OFFSET_LIMIT}
              max={OFFSET_LIMIT}
              unit="px"
              updateOn="commit"
              onChange={x => change({offset: {x}})}
            />
            <NumberField
              aria-label="세로 위치"
              readOnly={reason !== undefined}
              aria-disabled={reason !== undefined ? true : undefined}
              title={reason}
              value={offset.y}
              min={-OFFSET_LIMIT}
              max={OFFSET_LIMIT}
              unit="px"
              updateOn="commit"
              onChange={y => change({offset: {y}})}
            />
          </span>
        )}
      </PropertyRow>
    </PropertyGroup>
  );
}

function StabilityRows({
  screen,
  change,
  reason,
}: {
  readonly screen: Screen;
  readonly change: Change;
  readonly reason: string | undefined;
}): JSX.Element {
  return (
    <PropertyGroup title="안정성">
      {screen.method === 'fullscreen' && (
        <PropertyRow label="연결이 끊기면">
          {({controlId}) => (
            <SelectMenu
              id={controlId}
              disabled={reason !== undefined}
              title={reason}
              block
              menuLabel="연결이 끊기면"
              options={DISCONNECT_OPTIONS}
              value={onDisconnectOf(screen)}
              onChange={onDisconnect => change({onDisconnect})}
            />
          )}
        </PropertyRow>
      )}
      <PropertyRow label="항상 위">
        {({controlId}) => (
          <Switch
            id={controlId}
            disabled={reason !== undefined}
            title={reason}
            checked={alwaysOnTopOf(screen)}
            onChange={alwaysOnTop => change({alwaysOnTop})}
          />
        )}
      </PropertyRow>
    </PropertyGroup>
  );
}

function RefreshRateRow({
  screen,
  monitor,
}: {
  readonly screen: Screen;
  readonly monitor: MonitorInfo | undefined;
}): JSX.Element | null {
  if (screen.method !== 'fullscreen') return null;
  if (monitor === undefined || monitor.refreshRate <= 0) return null;
  return (
    <PropertyValue
      label="주사율"
      value={`${Math.round(monitor.refreshRate)}Hz`}
    />
  );
}

function PropertyRows({
  screen,
  screens,
  monitor,
  change,
  reason,
  monitors,
  assign,
  rename,
}: {
  readonly screen: Screen;
  readonly screens: readonly Screen[];
  readonly monitor: MonitorInfo | undefined;
  readonly change: Change;
  readonly reason: string | undefined;
  readonly monitors: MonitorList;
  readonly assign: (monitor: MonitorInfo) => void;
  readonly rename: (name: string) => void;
}): JSX.Element {
  return (
    <Properties className={styles.inset}>
      <PropertyGroup title="화면">
        <NameRow
          screen={screen}
          screens={screens}
          rename={rename}
          reason={reason}
        />
        <PropertyRow label="종류">
          {({controlId, labelId}) => (
            <SegmentedControl
              id={controlId}
              disabled={reason !== undefined}
              title={reason}
              labelledBy={labelId}
              options={KIND_OPTIONS}
              value={screen.kind}
              onChange={kind => change({kind})}
              fill
            />
          )}
        </PropertyRow>
      </PropertyGroup>
      <PropertyGroup title="출력">
        <PropertyRow label="방식">
          {({controlId, labelId}) => (
            <SegmentedControl
              id={controlId}
              disabled={reason !== undefined}
              title={reason}
              labelledBy={labelId}
              options={METHOD_OPTIONS}
              value={screen.method}
              onChange={method => change({method})}
              fill
            />
          )}
        </PropertyRow>
        <ScreenDeviceRow
          screen={screen}
          monitors={monitors}
          assigned={monitor}
          assign={assign}
          reason={reason}
        />
        <ResolutionRow
          screen={screen}
          monitor={monitor}
          change={change}
          reason={reason}
        />
        <RefreshRateRow screen={screen} monitor={monitor} />
      </PropertyGroup>
      <StabilityRows screen={screen} change={change} reason={reason} />
      <CorrectionRows screen={screen} change={change} reason={reason} />
    </Properties>
  );
}

/**
 * The properties of the selected screen (spec 06, "Screen properties"). Every
 * change is saved at once to `screens.json`.
 */
export function ScreenProperties({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const document = useSettingsDocument('screens', LOAD_TITLE, onProblem);
  const monitors = useMonitors();
  const select = useScreensSelection(view => view.select);
  const save = useScreenEditor(document, onProblem);
  const screens = document?.value.screens ?? noScreens;
  const selected = useScreenView(screens);
  const monitor = useMemo(
    () =>
      selected === undefined
        ? undefined
        : monitorAssignment(monitors).get(selected.id),
    [selected, monitors],
  );
  if (selected === undefined) return null;
  const reason = document?.access === 'editable' ? undefined : READ_ONLY_REASON;
  return (
    <PropertyRows
      key={`${selected.id}:${document?.access}`}
      screen={selected}
      screens={screens}
      monitor={monitor}
      reason={reason}
      monitors={monitors}
      rename={name => {
        if (reason !== undefined) return;
        select('screen', selected.id);
        save
          .rename(selected.id, name)
          .then(result => {
            if (result.ok) return;
            const title =
              result.error === 'missing'
                ? '화면을 찾을 수 없음'
                : NAME_PROBLEMS[result.error];
            onProblem?.({
              key: 'screens:rename',
              kind: 'warning',
              icon: 'warning',
              title,
              time: noticeTime(),
            });
          })
          .catch((cause: unknown) => {
            window.llp?.log.write({
              level: 'error',
              message: 'Could not rename the screen',
              detail: String(cause),
            });
            onProblem?.({
              key: 'screens:rename',
              kind: 'warning',
              icon: 'warning',
              title: '화면 설정 저장 실패',
              time: noticeTime(),
            });
          });
      }}
      assign={target => {
        if (reason !== undefined) return;
        select('screen', selected.id);
        save.assign(selected.id, target);
      }}
      change={change => {
        if (reason !== undefined) return;
        // NOTE(0913vision): A change of kind moves the screen to the other
        // group, which would move the fallback selection to another screen.
        select('screen', selected.id);
        save.change(selected.id, change);
      }}
    />
  );
}
