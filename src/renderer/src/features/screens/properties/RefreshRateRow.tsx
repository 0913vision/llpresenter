import type {Screen} from '@core/schema/screens/screens';
import type {JSX} from 'react';
import type {MonitorInfo} from '@core/schema/screens/monitors';
import {PropertyValue} from '@renderer/ui/panels/PropertyRow';

/** The 주사율 of the monitor a 화면 is shown on. */
export function RefreshRateRow({
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
