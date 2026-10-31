import {useState, type JSX} from 'react';
import {Checkbox} from '@renderer/ui/Checkbox';
import {NumberField} from '@renderer/ui/NumberField';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {TextArea} from '@renderer/ui/TextArea';
import {isComposing} from '@renderer/ui/ime';

export function ThemeContent({
  value,
  reason,
  change,
}: {
  readonly value: string;
  readonly reason: string | undefined;
  readonly change: (value: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <PropertyRow label="내용" alignTop>
      {({controlId}) => (
        <TextArea
          id={controlId}
          value={draft ?? value}
          readOnly={reason !== undefined}
          title={reason}
          onChange={setDraft}
          onBlur={() => {
            if (draft !== null && draft !== value && reason === undefined) {
              change(draft);
            }
            setDraft(null);
          }}
          onKeyDown={event => {
            if (isComposing(event)) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(null);
            }
            if (event.key === 'Enter' && event.ctrlKey) {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.blur();
            }
          }}
        />
      )}
    </PropertyRow>
  );
}

export function ThemeNumber({
  label,
  value,
  min = 0,
  max,
  step = 1,
  reason,
  change,
}: {
  readonly label: string;
  readonly value: number;
  readonly min?: number;
  readonly max: number;
  readonly step?: number;
  readonly reason: string | undefined;
  readonly change: (value: number) => void;
}): JSX.Element {
  return (
    <PropertyRow label={label}>
      {({controlId}) => (
        <NumberField
          id={controlId}
          value={value}
          min={min}
          max={max}
          step={step}
          updateOn="commit"
          readOnly={reason !== undefined}
          title={reason}
          onChange={change}
        />
      )}
    </PropertyRow>
  );
}
export function ThemeCheck({
  label,
  checked,
  reason,
  change,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly reason: string | undefined;
  readonly change: (value: boolean) => void;
}): JSX.Element {
  return (
    <PropertyRow label={label}>
      {({controlId, labelId}) => (
        <Checkbox
          id={controlId}
          aria-labelledby={labelId}
          checked={checked}
          disabled={reason !== undefined}
          title={reason}
          onChange={change}
        />
      )}
    </PropertyRow>
  );
}
