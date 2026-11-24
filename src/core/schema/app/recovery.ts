import * as v from 'valibot';
import type {Result} from '@core/common/result';
import type {ReadonlyKnown} from '../common/fileFormat';
import {
  screenIdSchema,
  serviceIdSchema,
  serviceItemIdSchema,
} from '../common/ids';
import {parsePayload, payloadObject, plainObject} from '../common/payload';
import {
  nonNegativeInteger,
  positiveInteger,
  timestamp,
} from '../common/primitives';

const MAX_RECOVERY_SCREENS = 200;
/** The kinds of row the 출력 상태 복구 dialog offers. */
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

/** One kind of row of the 출력 상태 복구 dialog. */
export type RecoveryRowKind = (typeof recoveryRowKinds)[number];

/** The selected restore rows and the timestamp of the offered record. */
export type RecoveryApply = ReadonlyKnown<v.InferOutput<typeof applySchema>>;

/** Why a restore failed, with a message for the dialog. */
export type RecoveryFailure = Readonly<v.InferOutput<typeof failureSchema>>;
/** The answer to a restore request: nothing on success, else the failure. */
export type RecoveryResult = Result<null, RecoveryFailure>;

/** Checks the summary of the crash state that the dialog offers. */
export function parseRecoverySummary(value: unknown) {
  return parsePayload(summarySchema, value);
}

/** Checks the rows the user chose to restore. */
export function parseRecoveryApply(value: unknown) {
  return parsePayload(applySchema, value);
}

/** Checks the answer to a restore request. */
export function parseRecoveryResult(value: unknown) {
  return parsePayload(resultSchema, value);
}
