import {useState, type JSX} from 'react';
import {resolveAudioSink, type AudioDevice} from '@core/media/audioOutput';
import {DEFAULT_AUDIO_DEVICE} from '@core/schema/preferences';
import {Icon} from '@renderer/ui/Icon';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {SelectMenu, type SelectOption} from '@renderer/ui/SelectMenu';
import {Tooltip} from '@renderer/ui/Tooltip';
import styles from './DeviceRow.module.css';

const WARNING_ICON_SIZE = 14;
const NO_NAME = '이름 없는 장치';
const DEFAULT_DEVICE_TEXT = 'Windows 기본 장치';
/** Why a saved device is not used: the choice stays and plays to the default. */
export const MISSING_DEVICE_REASON =
  '연결되지 않아 Windows 기본 장치로 재생합니다';

/**
 * A row that picks an audio output device: Windows 기본 장치, then each
 * connected device. A saved device that is not connected stays selected with
 * a warning icon and the reason in its tooltip, and plays to the default.
 */
export function DeviceRow({
  label,
  choice,
  devices,
  disabled,
  title,
  onChange,
  loading,
}: {
  readonly label: string;
  readonly choice: AudioDevice;
  readonly devices: readonly AudioDevice[];
  readonly disabled?: boolean | undefined;
  readonly title?: string | undefined;
  readonly onChange: (device: AudioDevice) => void;
  readonly loading?: boolean | undefined;
}): JSX.Element {
  const [snapshot, setSnapshot] = useState<{
    devices: readonly AudioDevice[];
    loading: boolean;
  } | null>(null);
  const available = snapshot?.devices ?? devices;
  const pending = snapshot?.loading ?? loading ?? false;
  const {missing, sinkId} = resolveAudioSink(choice, available);
  const value = missing ? choice.id : sinkId;
  const options: Array<SelectOption<string>> = [
    {value: '', label: DEFAULT_DEVICE_TEXT},
    ...available.map(device => ({
      value: device.id,
      label: device.label === '' ? NO_NAME : device.label,
    })),
    ...(pending
      ? [
          {
            value: '__loading__',
            label: '\ubd88\ub7ec\uc624\ub294 \uc911...',
            disabled: true as const,
            title:
              '\uc7a5\uce58 \ubaa9\ub85d\uc744 \ubd88\ub7ec\uc624\ub294 \uc911',
          },
        ]
      : []),
    ...(missing
      ? [
          {
            value: choice.id,
            label: choice.label === '' ? NO_NAME : choice.label,
          },
        ]
      : []),
  ];
  return (
    <PropertyRow label={label}>
      {({controlId}) => (
        <div className={styles.row}>
          <SelectMenu
            id={controlId}
            block
            menuLabel={label}
            disabled={disabled}
            title={title}
            options={options}
            value={value}
            onOpen={() => setSnapshot({devices, loading: loading ?? false})}
            onClose={() => setSnapshot(null)}
            onChange={id => {
              const device = available.find(entry => entry.id === id);
              onChange(
                device === undefined
                  ? DEFAULT_AUDIO_DEVICE
                  : {id: device.id, label: device.label},
              );
            }}
          />
          {missing ? (
            <Tooltip text={MISSING_DEVICE_REASON}>
              <span
                role="img"
                aria-label={MISSING_DEVICE_REASON}
                tabIndex={0}
                className={styles.warning}
              >
                <Icon name="warning" size={WARNING_ICON_SIZE} />
              </span>
            </Tooltip>
          ) : null}
        </div>
      )}
    </PropertyRow>
  );
}
