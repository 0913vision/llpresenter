import type {JSX} from 'react';
import {formatGeometryValue} from '@core/canvas/geometryValue';
import {NumberField, type NumberFieldProps} from './NumberField';

/** Shares geometry display precision while retaining explicitly typed values. */
export function GeometryField(props: NumberFieldProps): JSX.Element {
  return (
    <NumberField {...props} formatValue={formatGeometryValue} rounding="none" />
  );
}
