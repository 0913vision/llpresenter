import * as v from 'valibot';
import {parsePayload, payloadObject} from './payload';

const probabilityEntry = payloadObject({
  tok_str: v.optional(v.string()),
  token: v.optional(v.string()),
  prob: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
  logprob: v.optional(v.pipe(v.number(), v.maxValue(0))),
});
const completionSchema = payloadObject({
  content: v.optional(v.string()),
  completion_probabilities: v.optional(
    v.array(
      payloadObject({
        probs: v.optional(v.array(probabilityEntry)),
        top_logprobs: v.optional(v.array(probabilityEntry)),
      }),
    ),
  ),
});
const healthSchema = payloadObject({status: v.string()});

export function parseLlmCompletion(value: unknown) {
  return parsePayload(completionSchema, value);
}

export function parseLlmHealth(value: unknown) {
  return parsePayload(healthSchema, value);
}
