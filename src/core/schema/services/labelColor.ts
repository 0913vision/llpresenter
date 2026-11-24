import * as v from 'valibot';
import {isLabelColor, type LabelColor} from '@core/labels';

/** The color of a 이름표: `#RRGGBB`, or `none` for no color. */
export const labelColorSchema = v.custom<LabelColor>(
  isLabelColor,
  'Expected #RRGGBB or none',
);
