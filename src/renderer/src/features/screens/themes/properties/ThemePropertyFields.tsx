import {useEffect, useRef, useState, type JSX} from 'react';
import {Checkbox} from '@renderer/ui/choices/Checkbox';
import type {PictureFit} from '@core/schema/media/picturePlace';
import {NumberField} from '@renderer/ui/fields/NumberField';
import {PICTURE_FIT_OPTIONS} from '@renderer/ui/choices/mediaChoices';
import {PropertyRow} from '@renderer/ui/panels/PropertyRow';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import {TextArea} from '@renderer/ui/fields/TextArea';
import {isComposing} from '@renderer/ui/fields/ime';

/** A text that changes the picture while it is typed, as one undo step. */
export function ThemeTextArea({
  id,
  label,
  value,
  reason,
  change,
  begin,
  area,
}: {
  readonly id?: string | undefined;
  readonly label: string;
  readonly value: string;
  readonly reason: string | undefined;
  readonly change: (value: string) => void;
  readonly begin: () => () => void;
  readonly area?: ((element: HTMLTextAreaElement | null) => void) | undefined;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const original = useRef<string | null>(null);
  const endGroup = useRef<(() => void) | null>(null);
  const finish = (): void => {
    endGroup.current?.();
    endGroup.current = null;
    original.current = null;
  };
  useEffect(() => () => endGroup.current?.(), []);
  return (
    <TextArea
      id={id}
      ref={area}
      aria-label={label}
      value={draft ?? value}
      readOnly={reason !== undefined}
      title={reason}
      onChange={next => {
        if (reason !== undefined) return;
        if (original.current === null) {
          original.current = value;
          endGroup.current = begin();
        }
        setDraft(next);
        change(next);
      }}
      onBlur={() => {
        finish();
        setDraft(null);
      }}
      onKeyDown={event => {
        if (isComposing(event)) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          if (original.current !== null && reason === undefined) {
            change(original.current);
          }
          finish();
          setDraft(null);
        }
        if (event.key === 'Enter' && event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

const UNITS: Readonly<Record<string, string>> = {
  크기: 'px',
  '최소 크기': 'px',
  자간: 'px',
  '짧은 글 자간 값': 'px',
  두께: 'px',
  흐림: 'px',
  거리: 'px',
  모서리: 'px',
  간격: 'px',
  '위 여백': 'px',
  '아래 여백': 'px',
  각도: '도',
  불투명도: '%',
  '줄 간격': '배',
};

/**
 * A number field of the theme properties, kept between `min` and `max`;
 * `reason` disables it.
 */
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
          unit={UNITS[label]}
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
/** A check field of the theme properties; `reason` disables it. */
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

/** A number that can be left out; the check gives it a first value. */
export function ThemeOptionalNumber({
  label,
  value,
  first,
  min = 0,
  max,
  step = 1,
  reason,
  change,
}: {
  readonly label: string;
  readonly value: number | undefined;
  readonly first: number;
  readonly min?: number;
  readonly max: number;
  readonly step?: number;
  readonly reason: string | undefined;
  readonly change: (value: number | undefined) => void;
}): JSX.Element {
  return (
    <PropertyRow label={label}>
      {({controlId}) => (
        <>
          <Checkbox
            id={controlId}
            aria-label={label}
            checked={value !== undefined}
            disabled={reason !== undefined}
            title={reason}
            onChange={on => change(on ? first : undefined)}
          />
          {value === undefined ? null : (
            <NumberField
              aria-label={label}
              value={value}
              min={min}
              max={max}
              step={step}
              unit={UNITS[label]}
              updateOn="commit"
              readOnly={reason !== undefined}
              title={reason}
              onChange={change}
            />
          )}
        </>
      )}
    </PropertyRow>
  );
}

/** How a picture takes its frame. */
export function ThemeFitRow({
  value,
  reason,
  change,
}: {
  readonly value: PictureFit;
  readonly reason: string | undefined;
  readonly change: (value: PictureFit) => void;
}): JSX.Element {
  return (
    <PropertyRow label="맞춤">
      {({controlId}) => (
        <SelectMenu
          id={controlId}
          block
          value={value}
          disabled={reason !== undefined}
          title={reason}
          options={PICTURE_FIT_OPTIONS}
          onChange={change}
        />
      )}
    </PropertyRow>
  );
}
