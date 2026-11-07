import * as v from 'valibot';
import {jsonObject} from './primitives';
import {slidesSchema} from './service';

export const slideRowsClipboardSchema = jsonObject({
  format: v.literal('llp-slide-rows'),
  version: v.literal(1),
  content: slidesSchema,
});
