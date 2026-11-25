import {logFailure} from '@renderer/platform/logFailure';
import {SCREEN_NAME_PROBLEMS, SCREEN_SAVE_FAILED} from '../screenEditor';
import {type Screen, SCREEN_KIND_ORDER} from '@core/schema/screens/screens';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useMemo, type JSX} from 'react';
import type {MonitorInfo, MonitorList} from '@core/schema/screens/monitors';
import {
  emptyScreenColor,
  KIND_NAMES,
  monitorAssignment,
  lastOfKind,
} from '@core/screens';
import {ColorProperty} from '../ColorProperty';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
} from '@renderer/ui/panels/PropertyRow';
import {SegmentedControl} from '@renderer/ui/choices/SegmentedControl';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';
import {MessageStyleRow} from './MessageStyleRow';
import {useScreenView, useScreensSelection} from '../selection';
import {useMonitors} from '../useMonitors';
import {useScreenEditor} from '../useScreenEditor';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import {ScreenDeviceRow} from './ScreenDeviceRow';
import styles from './ScreenProperties.module.css';
import {NdiRows} from './NdiRows';
import {NameRow} from './NameRow';
import {ResolutionRow} from './ResolutionRow';
import {CorrectionRows} from './CorrectionRows';
import {StabilityRows} from './StabilityRows';
import {RefreshRateRow} from './RefreshRateRow';
import {type OnScreenChange} from './screenPropertyParts';

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
  readonly change: OnScreenChange;
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
            logFailure(window.llp, 'Could not rename the screen', cause);
            onProblem?.(warningNotice('screens:rename', SCREEN_SAVE_FAILED));
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
