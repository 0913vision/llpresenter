import * as v from 'valibot';
import {isLabelColor, type LabelColor} from '../labels/colors';

export const labelColorSchema = v.custom<LabelColor>(
  isLabelColor,
  'Expected #RRGGBB or none',
);
