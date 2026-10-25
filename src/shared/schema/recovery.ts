import * as v from 'valibot';
import type {Result} from '../result';
import type {ReadonlyKnown} from './fileFormat';
import {screenIdSchema, serviceIdSchema, serviceItemIdSchema} from './ids';
import {parsePayload, payloadObject, plainObject} from './payload';
import {nonNegativeInteger, positiveInteger, timestamp} from './primitives';

const MAX_RECOVERY_SCREENS = 200;
export const recoveryRowKinds = ['outputs', 'slide', 'showing'] as const;

const outputRowSchema = v.object({
  kind: v.literal('outputs'),
  screens: v.pipe(
    v.array(payloadObject({screenId: screenIdSchema, name: v.string()})),
    v.minLength(1),
    v.maxLength(MAX_RECOVERY_SCREENS),
    v.check(
      screens =>
        new Set(screens.map(({screenId}) => screenId)).size === screens.length,
      'Another recovery screen already has this id',
    ),
  ),
});

const slideSummarySchema = v.pipe(
  payloadObject({
    serviceId: serviceIdSchema,
    itemId: serviceItemIdSchema,
    title: v.string(),
    position: nonNegativeInteger,
    slideCount: positiveInteger,
  }),
  v.forward(
    v.check(
      ({position, slideCount}) => position < slideCount,
      'The slide position is outside the item',
    ),
    ['position'],
  ),
);

const showingCountsSchema = v.pipe(
  payloadObject({
    messages: nonNegativeInteger,
    props: nonNegativeInteger,
    stageMessages: nonNegativeInteger,
    notices: nonNegativeInteger,
    stageLayouts: nonNegativeInteger,
  }),
  v.check(
    counts => Object.values(counts).some(count => count > 0),
    'A showing row must have something to restore',
  ),
);

const recoveryRowSchema = v.pipe(
  plainObject,
  v.variant('kind', [
    outputRowSchema,
    v.object({kind: v.literal('slide'), slide: slideSummarySchema}),
    v.object({kind: v.literal('showing'), counts: showingCountsSchema}),
  ]),
);

const summarySchema = v.nullable(
  payloadObject({
    savedAt: timestamp,
    rows: v.pipe(
      v.array(recoveryRowSchema),
      v.minLength(1),
      v.maxLength(recoveryRowKinds.length),
      v.check(
        rows => new Set(rows.map(({kind}) => kind)).size === rows.length,
        'Another recovery row already has this kind',
      ),
    ),
  }),
);

const applySchema = payloadObject({
  savedAt: timestamp,
  rows: v.pipe(
    v.array(v.picklist(recoveryRowKinds)),
    v.minLength(1),
    v.maxLength(recoveryRowKinds.length),
    v.check(
      rows => new Set(rows).size === rows.length,
      'A recovery row is selected twice',
    ),
  ),
});

const failureSchema = payloadObject({
  reason: v.picklist([
    'unavailable',
    'stale',
    'invalid-selection',
    'apply-failed',
  ]),
  message: v.string(),
});

const resultSchema = v.pipe(
  plainObject,
  v.variant('ok', [
    v.object({ok: v.literal(true), value: v.null_()}),
    v.object({ok: v.literal(false), error: failureSchema}),
  ]),
);

/**
 * Null means no crash state is eligible. Rows contain display summaries only;
 * main retains the recovery record. Timers and audio have no restore row.
 * Positions are zero-based. Main omits deleted items and empty rows.
 */
export type RecoverySummary = ReadonlyKnown<
  v.InferOutput<typeof summarySchema>
>;

export type RecoveryRowKind = (typeof recoveryRowKinds)[number];

/**
 * The timestamp identifies the offered record; a changed record is stale.
 * Main restores selected rows in outputs, slide, showing order regardless of
 * request order, without item-start or startup macros. Start fresh follows
 * normal launch output preferences and startup macros instead.
 */
export type RecoveryApply = ReadonlyKnown<v.InferOutput<typeof applySchema>>;

export type RecoveryFailure = Readonly<v.InferOutput<typeof failureSchema>>;
export type RecoveryResult = Result<null, RecoveryFailure>;

export function parseRecoverySummary(value: unknown) {
  return parsePayload(summarySchema, value);
}

export function parseRecoveryApply(value: unknown) {
  return parsePayload(applySchema, value);
}

export function parseRecoveryResult(value: unknown) {
  return parsePayload(resultSchema, value);
}
