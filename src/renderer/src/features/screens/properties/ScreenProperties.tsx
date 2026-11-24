import {SCREEN_NAME_PROBLEMS} from '../screenEditor';
import {
  THEME_CANVAS,
  NDI_DEFAULT_HARDWARE_ACCELERATION,
  NDI_DEFAULT_FPS,
  NDI_FRAME_RATES,
  NDI_DEFAULT_SOURCE_NAME,
  NDI_SOURCE_NAME_MAX,
  type Screen,
  SCREEN_KIND_ORDER,
} from '@core/schema/screens/screens';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useMemo, useState, type JSX} from 'react';
import type {MonitorInfo, MonitorList} from '@core/schema/screens/monitors';
import {
  emptyScreenColor,
  KIND_NAMES,
  monitorAssignment,
  CAPTURE_RESOLUTIONS,
  EDGE_MARGIN_MAX,
  OFFSET_LIMIT,
  alwaysOnTopOf,
  nameProblem,
  lastOfKind,
  onDisconnectOf,
  type ScreenChange,
} from '@core/screens';
import {ColorProperty} from '../ColorProperty';
import {Checkbox} from '@renderer/ui/choices/Checkbox';
import {NumberField} from '@renderer/ui/fields/NumberField';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from '@renderer/ui/panels/PropertyRow';
import {SegmentedControl} from '@renderer/ui/choices/SegmentedControl';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import {TextField} from '@renderer/ui/fields/TextField';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';
import {isComposing} from '@renderer/ui/fields/ime';
import {hasModifier} from '@renderer/ui/keys/modifierKeys';
import {monitorPixelSize, pixelSizeText, targetSize} from '../displaySizes';
import {MessageStyleRow} from './MessageStyleRow';
import {useScreenView, useScreensSelection} from '../selection';
import {useMonitors} from '../useMonitors';
import {useOutputStatuses} from '../useOutputStatuses';
import {ndiAccelerationLabel, ndiAccelerationReason} from './ndiAcceleration';
import {useScreenEditor} from '../useScreenEditor';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import {ScreenDeviceRow} from './ScreenDeviceRow';
import styles from './ScreenProperties.module.css';

/** The canvas size, as the 해상도 rows and position titles name it. */
const CANVAS_SIZE = `${THEME_CANVAS.width} × ${THEME_CANVAS.height}`;

const LOAD_TITLE = '화면';
const noScreens: readonly Screen[] = [];
const READ_ONLY_REASON = NEWER_FILE_REASON;

const KIND_OPTIONS = SCREEN_KIND_ORDER.map(value => ({
  value,
  label: KIND_NAMES[value],
}));
const METHOD_OPTIONS = [
  {value: 'fullscreen', label: '전체 화면'},
  {value: 'window', label: '창'},
  {value: 'capture', label: '캡처용 창'},
  {value: 'ndi', label: 'NDI'},
] as const;
const BROADCAST_METHOD_OPTIONS = [
  METHOD_OPTIONS[3],
  METHOD_OPTIONS[2],
] as const;
const DISCONNECT_OPTIONS = [
  {value: 'window', label: '창으로 바꾸기'},
  {value: 'off', label: '출력 끄기'},
] as const;

type Change = (change: ScreenChange) => void;

function NdiRows({
  screen,
  screens,
  change,
  reason,
}: {
  readonly screen: Screen;
  readonly screens: readonly Screen[];
  readonly change: Change;
  readonly reason: string | undefined;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const status = useOutputStatuses()[screen.id];
  const accelerationReason = ndiAccelerationReason(status);
  const source = screen.ndi?.sourceName ?? NDI_DEFAULT_SOURCE_NAME;
  const duplicate =
    draft !== null &&
    screens.some(
      other =>
        other.id !== screen.id &&
        other.method === 'ndi' &&
        (other.ndi?.sourceName ?? NDI_DEFAULT_SOURCE_NAME).trim() ===
          draft.trim(),
    );
  return (
    <>
      <PropertyRow label="소스 이름">
        {({controlId}) => (
          <TextField
            id={controlId}
            block
            maxLength={NDI_SOURCE_NAME_MAX}
            readOnly={reason !== undefined}
            value={draft ?? source}
            invalid={duplicate}
            invalidReason={
              duplicate ? '같은 NDI 소스 이름이 있습니다.' : undefined
            }
            onChange={setDraft}
            onBlur={() => {
              if (draft !== null && draft.trim() !== '' && !duplicate) {
                change({ndi: {...screen.ndi, sourceName: draft.trim()}});
              }
              setDraft(null);
            }}
            onKeyDown={event => {
              if (
                event.key === 'Enter' &&
                !isComposing(event) &&
                !hasModifier(event)
              ) {
                event.currentTarget.blur();
              }
            }}
          />
        )}
      </PropertyRow>
      <PropertyRow label="하드웨어 가속">
        {({controlId}) => (
          <Checkbox
            id={controlId}
            checked={
              screen.ndi?.hardwareAcceleration ??
              NDI_DEFAULT_HARDWARE_ACCELERATION
            }
            disabled={reason !== undefined}
            title={reason}
            onChange={hardwareAcceleration =>
              change({ndi: {...screen.ndi, hardwareAcceleration}})
            }
          />
        )}
      </PropertyRow>
      {status?.placement === 'ndi' ? (
        <PropertyValue label="가속 상태" value={ndiAccelerationLabel(status)} />
      ) : null}
      {status?.placement === 'ndi' && accelerationReason ? (
        <PropertyValue
          label="가속을 사용하지 않는 이유"
          value={accelerationReason}
        />
      ) : null}
      <PropertyValue label="해상도" value={CANVAS_SIZE} />
      <PropertyRow label="프레임 수">
        {({controlId}) => (
          <SelectMenu
            id={controlId}
            disabled={reason !== undefined}
            title={reason}
            block
            menuLabel="프레임 수"
            options={NDI_FRAME_RATES.map(fps => ({
              value: String(fps),
              label: `${fps} fps`,
            }))}
            value={String(screen.ndi?.fps ?? NDI_DEFAULT_FPS)}
            onChange={value => {
              const fps = NDI_FRAME_RATES.find(rate => String(rate) === value);
              if (fps !== undefined) change({ndi: {...screen.ndi, fps}});
            }}
          />
        )}
      </PropertyRow>
    </>
  );
}

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
            problem === undefined ? undefined : SCREEN_NAME_PROBLEMS[problem]
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
              value: pixelSizeText(size),
              label: pixelSizeText(size),
            }))}
            value={current === undefined ? undefined : pixelSizeText(current)}
            onChange={value => {
              const size = CAPTURE_RESOLUTIONS.find(
                candidate => pixelSizeText(candidate) === value,
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
    <PropertyValue
      label="해상도"
      value={pixelSizeText(monitorPixelSize(monitor))}
    />
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
              title={reason ?? `${CANVAS_SIZE} 화면 기준 px`}
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
              title={reason ?? `${CANVAS_SIZE} 화면 기준 px`}
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
          <Checkbox
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
  onProblem,
}: {
  readonly screen: Screen;
  readonly screens: readonly Screen[];
  readonly monitor: MonitorInfo | undefined;
  readonly change: Change;
  readonly reason: string | undefined;
  readonly monitors: MonitorList;
  readonly assign: (monitor: MonitorInfo) => void;
  readonly rename: (name: string) => void;
  readonly onProblem: ((notice: Notice) => void) | undefined;
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
              onChange={kind => {
                if (kind !== screen.kind && lastOfKind(screens, screen)) {
                  onProblem?.(
                    warningNotice(
                      'screens:kind',
                      '마지막 화면의 종류는 바꿀 수 없습니다.',
                    ),
                  );
                  return;
                }
                change({kind});
              }}
              fill
            />
          )}
        </PropertyRow>
        <MessageStyleRow
          screen={screen}
          reason={reason}
          onProblem={onProblem}
          onChange={messageStyleId => change({messageStyleId})}
        />
      </PropertyGroup>
      <PropertyGroup title="출력">
        <PropertyRow label="방식">
          {({controlId, labelId}) => (
            <SegmentedControl
              id={controlId}
              disabled={reason !== undefined}
              title={reason}
              labelledBy={labelId}
              options={
                screen.kind === 'broadcast'
                  ? BROADCAST_METHOD_OPTIONS
                  : METHOD_OPTIONS.filter(option => option.value !== 'ndi')
              }
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
        {screen.method === 'ndi' ? (
          <NdiRows
            screen={screen}
            screens={screens}
            change={change}
            reason={reason}
          />
        ) : null}
        <ResolutionRow
          screen={screen}
          monitor={monitor}
          change={change}
          reason={reason}
        />
        <RefreshRateRow screen={screen} monitor={monitor} />
        {screen.method !== 'ndi' && (
          <ColorProperty
            label="빈 화면 색"
            value={emptyScreenColor(screen)}
            reason={reason}
            commit={emptyColor => change({emptyColor})}
          />
        )}
      </PropertyGroup>
      {screen.method === 'ndi' ? null : (
        <StabilityRows screen={screen} change={change} reason={reason} />
      )}
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
        select(selected.id);
        save
          .rename(selected.id, name)
          .then(result => {
            if (result.ok) return;
            const title =
              result.error === 'missing'
                ? '화면을 찾을 수 없음'
                : SCREEN_NAME_PROBLEMS[result.error];
            onProblem?.(warningNotice('screens:rename', title));
          })
          .catch((cause: unknown) => {
            window.llp?.log.write({
              level: 'error',
              message: 'Could not rename the screen',
              detail: String(cause),
            });
            onProblem?.(warningNotice('screens:rename', '화면 설정 저장 실패'));
          });
      }}
      assign={target => {
        if (reason !== undefined) return;
        select(selected.id);
        save.assign(selected.id, target);
      }}
      change={change => {
        if (reason !== undefined) return;
        // NOTE(0913vision): A change of kind moves the screen to the other
        // group, which would move the fallback selection to another screen.
        select(selected.id);
        save.change(selected.id, change);
      }}
      onProblem={onProblem}
    />
  );
}
