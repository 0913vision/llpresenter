import {serviceIdSchema, type ServiceId} from './ids';
import {checkPart} from './fileFormat';
import {payloadObject} from './payload';
import {parseShowService} from './showService';
import type * as v from 'valibot';

const serviceOpenSchema = payloadObject({serviceId: serviceIdSchema});

export type ServiceOpenRequest = Readonly<
  v.InferOutput<typeof serviceOpenSchema>
>;

export function parseServiceOpenRequest(value: unknown) {
  return checkPart(serviceOpenSchema, value);
}

/** An opened service must be the one requested; null means the switch did not succeed. */
export function parseServiceOpenReply(serviceId: ServiceId, value: unknown) {
  const parsed = parseShowService(value);
  return parsed.ok && parsed.value !== null && parsed.value.id !== serviceId
    ? ({
        ok: false,
        error: {field: 'id', message: 'The reply names another service'},
      } as const)
    : parsed;
}
