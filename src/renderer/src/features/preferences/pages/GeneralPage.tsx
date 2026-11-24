import type {JSX} from 'react';
import {UI_ZOOM} from '@core/schema/app/uiZoom';
import {PropertyGroup} from '@renderer/ui/panels/PropertyRow';
import {CheckboxRow, SelectRow} from '../PreferenceRows';
import {useUiZoom} from '../useUiZoom';
import type {PageProps} from './pageProps';

const ZOOM_OPTIONS = Array.from(
  {length: (UI_ZOOM.max - UI_ZOOM.min) / UI_ZOOM.step + 1},
  (_, index) => {
    const percent = UI_ZOOM.min + index * UI_ZOOM.step;
    return {value: String(percent), label: `${percent}%`};
  },
);

/** 일반: 화면 확대, Windows 시작할 때 실행. */
export function GeneralPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  const zoom = useUiZoom();
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  return (
    <PropertyGroup>
      <SelectRow
        label="화면 확대"
        disabled={zoom.percent === null}
        options={ZOOM_OPTIONS}
        value={String(zoom.percent ?? UI_ZOOM.defaultPercent)}
        onChange={percent => zoom.setPercent(Number(percent))}
      />
      <CheckboxRow
        label="시작할 때 최대화"
        disabled={disabled}
        title={lockedReason}
        checked={preferences.general.startMaximized}
        onChange={startMaximized =>
          change(stored => ({
            ...stored,
            general: {...stored.general, startMaximized},
          }))
        }
      />
      <CheckboxRow
        label="Windows 시작할 때 실행"
        disabled={disabled}
        title={lockedReason}
        checked={preferences.general.launchAtLogin}
        onChange={launchAtLogin =>
          change(stored => ({
            ...stored,
            general: {...stored.general, launchAtLogin},
          }))
        }
      />
    </PropertyGroup>
  );
}
