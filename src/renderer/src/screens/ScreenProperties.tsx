import {useMemo, useState, type JSX} from 'react';
import type {MonitorInfo} from '@shared/schema/monitors';
import type {Screen} from '@shared/schema/screens';
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
import type {Notice} from '@renderer/ui/notices';
import {monitorPixelSize, sizeText, targetSize} from './displaySizes';
import {monitorAssignment} from './monitorAssignment';
import {
  CAPTURE_RESOLUTIONS,
  EDGE_MARGIN_MAX,
  OFFSET_LIMIT,
  alwaysOnTopOf,
  nameProblem,
  onDisconnectOf,
  type ScreenChange,
} from './screenEdits';
import {selectedScreenIn, useScreensSelection} from './selection';
import {useMonitors} from './useMonitors';
import {useScreenEditor} from './useScreenEditor';
import {useSettingsDocument} from './useSettingsDocument';
import styles from './ScreenProperties.module.css';

const LOAD_TITLE = '화면';
const noScreens: readonly Screen[] = [];
const NDI_UNAVAILABLE = '이번 버전에서는 사용할 수 없음';
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
  change,
}: {
  readonly screen: Screen;
  readonly screens: readonly Screen[];
  readonly change: Change;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? screen.name;
  const problem = nameProblem(shown, screens, screen.id);
  const commit = (): void => {
    if (problem === undefined && shown.trim() !== screen.name) {
      change({name: shown.trim()});
    }
    setDraft(null);
  };
  return (
    <PropertyRow label="이름">
      {({controlId}) => (
        <TextField
          id={controlId}
          block
          value={shown}
          onChange={setDraft}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
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
}: {
  readonly screen: Screen;
  readonly monitor: MonitorInfo | undefined;
  readonly change: Change;
}): JSX.Element | null {
  if (screen.method === 'capture') {
    const current = targetSize(screen);
    return (
      <PropertyRow label="해상도">
        {({controlId}) => (
          <SelectMenu
            id={controlId}
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
}: {
  readonly screen: Screen;
  readonly change: Change;
}): JSX.Element {
  const offset = screen.offset ?? {x: 0, y: 0};
  return (
    <PropertyGroup title="보정">
      <PropertyRow label="가장자리 여백">
        {({controlId}) => (
          <NumberField
            id={controlId}
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
              aria-label="가로 위치"
              value={offset.x}
              min={-OFFSET_LIMIT}
              max={OFFSET_LIMIT}
              unit="px"
              updateOn="commit"
              onChange={x => change({offset: {...offset, x}})}
            />
            <NumberField
              aria-label="세로 위치"
              value={offset.y}
              min={-OFFSET_LIMIT}
              max={OFFSET_LIMIT}
              unit="px"
              updateOn="commit"
              onChange={y => change({offset: {...offset, y}})}
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
}: {
  readonly screen: Screen;
  readonly change: Change;
}): JSX.Element {
  return (
    <PropertyGroup title="안정성">
      {screen.method === 'fullscreen' && (
        <PropertyRow label="연결이 끊기면">
          {({controlId}) => (
            <SelectMenu
              id={controlId}
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
}: {
  readonly screen: Screen;
  readonly screens: readonly Screen[];
  readonly monitor: MonitorInfo | undefined;
  readonly change: Change;
}): JSX.Element {
  return (
    <Properties>
      <PropertyGroup title="화면">
        <NameRow screen={screen} screens={screens} change={change} />
        <PropertyRow label="종류">
          {({controlId, labelId}) => (
            <SegmentedControl
              id={controlId}
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
              labelledBy={labelId}
              options={METHOD_OPTIONS}
              value={screen.method}
              onChange={method => change({method})}
              fill
            />
          )}
        </PropertyRow>
        <ResolutionRow screen={screen} monitor={monitor} change={change} />
        <RefreshRateRow screen={screen} monitor={monitor} />
      </PropertyGroup>
      <StabilityRows screen={screen} change={change} />
      <CorrectionRows screen={screen} change={change} />
    </Properties>
  );
}

/**
 * The properties of the selected screen (spec 06, "Screen properties"). Every
 * change is saved at once to `screens.json`. The 장치 row comes with the
 * monitor assignment.
 */
export function ScreenProperties({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const document = useSettingsDocument('screens', LOAD_TITLE, onProblem);
  const monitors = useMonitors();
  const selection = useScreensSelection(view => view.selection);
  const select = useScreensSelection(view => view.select);
  const save = useScreenEditor(document, onProblem);
  const screens = document?.value.screens ?? noScreens;
  const selected = selectedScreenIn(selection, screens);
  const monitor = useMemo(
    () =>
      selected === undefined
        ? undefined
        : monitorAssignment(monitors).get(selected.id),
    [selected, monitors],
  );
  if (selected === undefined) return null;
  return (
    <PropertyRows
      key={selected.id}
      screen={selected}
      screens={screens}
      monitor={monitor}
      change={change => {
        // NOTE(0913vision): A change of kind moves the screen to the other
        // group, which would move the fallback selection to another screen.
        select('screen', selected.id);
        save(selected.id, change);
      }}
    />
  );
}
