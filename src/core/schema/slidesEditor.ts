import * as v from 'valibot';
import {serviceIdSchema, serviceItemIdSchema} from './ids';
import {parsePayload, payloadObject} from './payload';
import {serviceSchema} from './service';
import type {ReadonlyKnown} from './fileFormat';

const targetSchema = payloadObject({
  serviceId: serviceIdSchema,
  itemId: serviceItemIdSchema,
  focusText: v.exactOptional(v.boolean()),
});
const savedSchema = payloadObject({
  before: serviceSchema,
  after: serviceSchema,
});

export type SlidesEditorTarget = ReadonlyKnown<
  v.InferOutput<typeof targetSchema>
>;
export type SlidesEditorSaved = ReadonlyKnown<
  v.InferOutput<typeof savedSchema>
>;

export const parseSlidesEditorTarget = (value: unknown) =>
  parsePayload(targetSchema, value);
export const parseSlidesEditorSaved = (value: unknown) =>
  parsePayload(savedSchema, value);
