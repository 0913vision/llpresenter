import {
  NDI_DEFAULT_HARDWARE_ACCELERATION,
  NDI_DEFAULT_FPS,
  NDI_FRAME_RATES,
  NDI_DEFAULT_SOURCE_NAME,
  NDI_SOURCE_NAME_MAX,
  type Screen,
} from '@core/schema/screens/screens';
import {useState, type JSX} from 'react';
import {Checkbox} from '@renderer/ui/choices/Checkbox';
import {PropertyRow, PropertyValue} from '@renderer/ui/panels/PropertyRow';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import {TextField} from '@renderer/ui/fields/TextField';
import {isComposing} from '@renderer/ui/fields/ime';
import {hasModifier} from '@renderer/ui/keys/modifierKeys';
import {useOutputStatuses} from '../useOutputStatuses';
import {ndiAccelerationLabel, ndiAccelerationReason} from './ndiAcceleration';
import {CANVAS_SIZE, type OnScreenChange} from './screenPropertyParts';

/** The NDI rows of a 방송 화면: 소스 이름, 하드웨어 가속 with its state, and the 해상도 it sends. */
export function NdiRows({
  screen,
  screens,
  change,
  reason,
}: {
  readonly screen: Screen;
  readonly screens: readonly Screen[];
  readonly change: OnScreenChange;
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
