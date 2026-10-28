import type {JSX} from 'react';
import type {StageElement} from '@shared/schema/stageLayouts';
import {NumberField, PropertyRow} from '@renderer/ui';
import type {StageBoxPatch} from './stageEditor';
import {StageColorProperty} from './StageColorProperty';

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
      <StageColorProperty
        label="배경색"
        value={box?.background ?? ''}
        allowNone
        reason={reason}
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
