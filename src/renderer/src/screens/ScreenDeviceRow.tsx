import type {JSX} from 'react';
import type {MonitorInfo, MonitorList} from '@shared/schema/monitors';
import type {Screen} from '@shared/schema/screens';
import {PropertyRow, SelectMenu} from '@renderer/ui';

/** The saved full screen device; the control monitor is never offered. */
export function ScreenDeviceRow({
  screen,
  monitors,
  assigned,
  assign,
  reason,
}: {
  readonly screen: Screen;
  readonly monitors: MonitorList;
  readonly assigned: MonitorInfo | undefined;
  readonly assign: (monitor: MonitorInfo) => void;
  readonly reason: string | undefined;
}): JSX.Element | null {
  if (screen.method !== 'fullscreen') return null;
  const choices = monitors.filter(
    monitor => !monitor.hasMainWindow && monitor.id !== undefined,
  );
  const current = assigned ?? screen.display;
  return (
    <PropertyRow label="장치">
      {({controlId}) => (
        <SelectMenu
          id={controlId}
          disabled={reason !== undefined}
          title={reason}
          block
          menuLabel="장치"
          value={current?.id?.toString()}
          valueText={
            current === undefined ? undefined : `모니터 ${current.number}`
          }
          meta={current?.name}
          options={choices.map(monitor => ({
            value: String(monitor.id),
            label: `모니터 ${monitor.number}`,
            meta: monitor.name,
          }))}
          onChange={value => {
            const monitor = choices.find(item => String(item.id) === value);
            if (monitor !== undefined) assign(monitor);
          }}
        />
      )}
    </PropertyRow>
  );
}
