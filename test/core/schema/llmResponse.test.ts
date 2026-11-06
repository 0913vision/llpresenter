import {describe, expect, it} from 'vitest';
import {parseLlmCompletion, parseLlmHealth} from '@core/schema/llmResponse';

describe('local LLM response schemas', () => {
  it('checks health bodies and completion field types before they enter main', () => {
    expect(parseLlmHealth({status: 'ok', slots: 1})).toEqual({
      ok: true,
      value: {status: 'ok'},
    });
    expect(parseLlmHealth({status: 'loading'}).ok).toBe(true);
    for (const body of [null, [], {}, {status: true}]) {
      expect(parseLlmHealth(body).ok).toBe(false);
    }
    expect(parseLlmCompletion({content: '1', ignored: true})).toEqual({
      ok: true,
      value: {content: '1'},
    });
    expect(
      parseLlmCompletion({
        completion_probabilities: [
          {
            probs: [{tok_str: '1', prob: 0.7}],
            top_logprobs: [{token: '1', logprob: -1}],
          },
        ],
      }).ok,
    ).toBe(true);
    for (const body of [
      null,
      [],
      {content: 1},
      {completion_probabilities: '1'},
      {completion_probabilities: [{probs: [{token: 1}]}]},
      {completion_probabilities: [{probs: [{prob: 2}]}]},
      {completion_probabilities: [{top_logprobs: [{logprob: '0'}]}]},
    ]) {
      expect(parseLlmCompletion(body).ok).toBe(false);
    }
  });
});
