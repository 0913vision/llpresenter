import type {JSX} from 'react';
import {
  WHOLE_AREA,
  type PictureArea,
  type PictureFit,
  type PicturePlace,
} from '@core/schema/picturePlace';
import {NumberField} from './NumberField';
import {PropertyRow} from './PropertyRow';
import {SelectMenu} from './SelectMenu';

/** The names of the fits, in the order every menu of them has. */
export const PICTURE_FIT_OPTIONS = [
  {value: 'fill', label: '채우기'},
  {value: 'fit', label: '맞추기'},
  {value: 'stretch', label: '늘리기'},
] as const satisfies ReadonlyArray<{
  readonly value: PictureFit;
  readonly label: string;
}>;

const PERCENT = 100;
const SCALE = {min: 10, max: 400};

const ROWS = [
  {label: '크기', field: 'scale', ...SCALE},
  {label: '가로 위치', field: 'x', min: -PERCENT, max: PERCENT},
  {label: '세로 위치', field: 'y', min: -PERCENT, max: PERCENT},
] as const;

function percent(share: number): number {
  return Math.round(share * PERCENT);
}

/** A place without the area that is the whole screen. */
function placed(fit: PictureFit | undefined, area: PictureArea): PicturePlace {
  const whole = area.x === 0 && area.y === 0 && area.scale === 1;
  return {
    ...(fit === undefined ? {} : {fit}),
    ...(whole ? {} : {area}),
  };
}

/**
 * 맞춤, 크기, 가로 위치 and 세로 위치 of a picture: the same four rows for the
 * background of a slide and for a media item.
 */
export function PicturePlaceRows({
  value,
  disabled,
  onChange,
}: {
  readonly value: PicturePlace;
  readonly disabled: boolean;
  /** The whole new place; what it leaves out is back to the start. */
  readonly onChange: (value: PicturePlace) => void;
}): JSX.Element {
  const area = value.area ?? WHOLE_AREA;
  return (
    <>
      <PropertyRow label="맞춤">
        {({controlId}) => (
          <SelectMenu
            id={controlId}
            block
            value={value.fit ?? 'fill'}
            disabled={disabled}
            options={PICTURE_FIT_OPTIONS}
            onChange={fit => onChange(placed(fit, area))}
          />
        )}
      </PropertyRow>
      {ROWS.map(({label, field, min, max}) => (
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
              onChange={number =>
                onChange(
                  placed(value.fit, {...area, [field]: number / PERCENT}),
                )
              }
            />
          )}
        </PropertyRow>
      ))}
    </>
  );
}
