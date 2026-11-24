import * as v from 'valibot';
import type {Result} from '@core/common/result';
import {serviceIdSchema, type ServiceId} from '../common/ids';
import {checkPart} from '../common/fileFormat';
import {
  parsePayload,
  payloadObject,
  type PayloadError,
} from '../common/payload';
import {parseShowService, type ShowService} from './showService';

const serviceOpenSchema = payloadObject({serviceId: serviceIdSchema});

export type ServiceOpenRequest = Readonly<
  v.InferOutput<typeof serviceOpenSchema>
>;

export function parseServiceOpenRequest(value: unknown) {
  return checkPart(serviceOpenSchema, value);
}

/**
 * Why a 예배 순서 did not open: it is not there any more, too many switches
 * wait already, or reading or saving it failed.
 */
export const serviceOpenRefusals = ['missing', 'busy', 'failed'] as const;

export type ServiceOpenRefusal = (typeof serviceOpenRefusals)[number];

/** The service that opened, or why it did not. */
export type ServiceOpenResult = Result<
  ShowService,
  {readonly reason: ServiceOpenRefusal}
>;

const refusedSchema = payloadObject({
  ok: v.literal(false),
  error: payloadObject({reason: v.picklist(serviceOpenRefusals)}),
});
const openedSchema = payloadObject({ok: v.literal(true), value: v.unknown()});

/** An opened service must be the one requested. */
export function parseServiceOpenReply(
  serviceId: ServiceId,
  value: unknown,
): Result<ServiceOpenResult, PayloadError> {
  const refused = parsePayload(refusedSchema, value);
  if (refused.ok) {
    return {ok: true, value: {ok: false, error: refused.value.error}};
  }
  const opened = parsePayload(openedSchema, value);
  if (!opened.ok) return opened;
  const service = parseShowService(opened.value.value);
  if (!service.ok) return service;
  if (service.value?.id !== serviceId) {
    return {
      ok: false,
      error: {field: 'id', message: 'The reply names another service'},
    };
  }
  return {ok: true, value: {ok: true, value: service.value}};
}
