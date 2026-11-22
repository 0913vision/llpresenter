import type {JSX} from 'react';
import type {SlideBackground} from '@core/schema/theme';
import {NumberField} from '@renderer/ui/NumberField';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {SelectMenu} from '@renderer/ui/SelectMenu';

type Picture = Extract<SlideBackground, {readonly kind: 'media'}>;
type Area = NonNullable<Picture['area']>;

const FITS = [
  {value: 'fill', label: '채우기'},
  {value: 'fit', label: '맞추기'},
  {value: 'stretch', label: '늘리기'},
] as const;

const WHOLE: Area = {x: 0, y: 0, scale: 1};
const PERCENT = 100;
const SCALE = {min: 10, max: 400};

function percent(share: number): number {
  return Math.round(share * PERCENT);
}

/** Where a background picture is on the screen, and how large it is. */
export function BackgroundPlace({
  value,
  disabled,
  onChange,
}: {
  readonly value: Picture;
  readonly disabled: boolean;
  readonly onChange: (value: Picture) => void;
}): JSX.Element {
  const area = value.area ?? WHOLE;
  const place = (change: Partial<Area>): void => {
    const next = {...area, ...change};
    const {area: _area, ...whole} = value;
    onChange(
      next.x === 0 && next.y === 0 && next.scale === 1
        ? whole
        : {...whole, area: next},
    );
  };
  const rows = [
    {label: '크기', field: 'scale', ...SCALE},
    {label: '가로 위치', field: 'x', min: -PERCENT, max: PERCENT},
    {label: '세로 위치', field: 'y', min: -PERCENT, max: PERCENT},
  ] as const;
  return (
    <>
      <PropertyRow label="맞춤">
        {({controlId}) => (
          <SelectMenu
            id={controlId}
            block
            value={value.fit ?? 'fill'}
            disabled={disabled}
            options={FITS}
            onChange={fit => onChange({...value, fit})}
          />
        )}
      </PropertyRow>
      {rows.map(({label, field, min, max}) => (
        <PropertyRow key={field} label={label}>
          {({controlId}) => (
            <NumberField
              id={controlId}
              value={percent(area[field])}
              min={min}
              max={max}
              unit="%"
              updateOn="commit"
              readOnly={disabled}
              onChange={number => place({[field]: number / PERCENT})}
            />
          )}
        </PropertyRow>
      ))}
    </>
  );
}
