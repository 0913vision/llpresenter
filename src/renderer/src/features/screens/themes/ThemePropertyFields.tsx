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
  const units: Readonly<Record<string, string>> = {
    크기: 'px',
    자간: 'px',
    '짧은 글 자간 값': 'px',
    두께: 'px',
    흐림: 'px',
    거리: 'px',
    모서리: 'px',
    각도: '도',
    불투명도: '%',
    '줄 간격': '배',
  };
  return (
    <PropertyRow label={label}>
      {({controlId}) => (
        <NumberField
          id={controlId}
          value={value}
          min={min}
          max={max}
          step={step}
          unit={units[label]}
          {...(label === '줄 간격'
            ? {
                formatValue: (number: number) =>
                  String(Math.round(number * 100) / 100),
              }
            : {})}
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
