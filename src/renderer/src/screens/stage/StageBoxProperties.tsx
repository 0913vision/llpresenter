import type {JSX} from 'react';
import type {StageElement} from '@shared/schema/stageLayouts';
import {isLyricTextColor} from '@shared/schema/textStyle';
import {NumberField, PropertyRow} from '@renderer/ui';
import type {StageBoxPatch} from './stageEditor';
import {StageStringProperty} from './StageTextProperties';

const PERCENT_MAX = 100;

/** Edits only the element fill; transparency leaves its text fully opaque. */
export function StageBoxProperties({
  box,
  reason,
  change,
}: {
  box: StageElement['box'];
  reason: string | undefined;
  change: (patch: StageBoxPatch) => void;
}): JSX.Element {
  return (
    <>
      <StageStringProperty
        label="배경색"
        value={box?.background ?? ''}
        placeholder="없음"
        reason={reason}
        validate={value =>
          value === '' || isLyricTextColor(value)
            ? undefined
            : '#RRGGBB 형식으로 입력'
        }
        commit={background =>
          change({
            background: background === '' ? null : background.toUpperCase(),
          })
        }
      />
      <PropertyRow label="불투명도">
        {({controlId}) => (
          <NumberField
            id={controlId}
            value={(box?.opacity ?? 1) * PERCENT_MAX}
            min={0}
            max={PERCENT_MAX}
            unit="%"
            readOnly={reason !== undefined}
            title={reason}
            updateOn="commit"
            onChange={value => change({opacity: value / PERCENT_MAX})}
          />
        )}
      </PropertyRow>
    </>
  );
}
