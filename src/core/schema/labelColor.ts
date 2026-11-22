import * as v from 'valibot';
import {isLabelColor, type LabelColor} from '@core/labels';

export const labelColorSchema = v.custom<LabelColor>(
  isLabelColor,
  'Expected #RRGGBB or none',
);
