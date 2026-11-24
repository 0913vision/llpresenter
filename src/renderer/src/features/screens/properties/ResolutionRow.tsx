import type {Screen} from '@core/schema/screens/screens';
import type {JSX} from 'react';
import type {MonitorInfo} from '@core/schema/screens/monitors';
import {CAPTURE_RESOLUTIONS} from '@core/screens';
import {PropertyRow, PropertyValue} from '@renderer/ui/panels/PropertyRow';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import {monitorPixelSize, pixelSizeText, targetSize} from '../displaySizes';
import type {OnScreenChange} from './screenPropertyParts';

/** The 해상도 row of a 화면. */
export function ResolutionRow({
  screen,
  monitor,
  change,
  reason,
}: {
  readonly screen: Screen;
  readonly monitor: MonitorInfo | undefined;
  readonly change: OnScreenChange;
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
