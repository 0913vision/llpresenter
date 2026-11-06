import {describe, expect, it, vi} from 'vitest';
import {buildPrompt, createChooser} from '@main/bible/llm/chooser';
import {readMockLlmBody, startMockLlm} from '@fixtures/main/llmHttp';

const TEXT = '처음 말 다음 말 마지막 말';
const CANDIDATES = ['처음 말', '처음 말 다음 말', TEXT];
const COPIBLE_PROMPT = `<|im_start|>system
당신은 한국어 성경 한 절을 예배용 슬라이드 두 장에 나눠 담습니다.

같은 절을 두 가지 방법으로 나눈 것을 보여드립니다. 절이 원래 나뉘는 자리에서
끊은 쪽을 고르세요. 1 또는 2만 적으세요.<|im_end|>
<|im_start|>user
1번
  앞장: 처음 말
  뒷장: 다음 말 마지막 말

2번
  앞장: 처음 말 다음 말 마지막 말
  뒷장: (없음)<|im_end|>
<|im_start|>assistant
`;

describe('Copible boundary chooser', () => {
  it.each([
    'https://example.invalid',
    'http://example.invalid',
    'http://127.0.0.2',
    'https://127.0.0.1',
  ])(
    'refuses a non-loopback HTTP endpoint %s before fetching',
    async endpoint => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      await expect(
        createChooser({endpoint})(TEXT, TEXT, CANDIDATES),
      ).rejects.toThrow('loopback HTTP');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('refuses redirects rather than reaching another origin', async () => {
    const {endpoint} = await startMockLlm((_request, response) => {
      response.writeHead(302, {Location: 'https://example.invalid/completion'});
      response.end();
    });
    await expect(
      createChooser({endpoint})(TEXT, TEXT, CANDIDATES),
    ).rejects.toThrow();
  });
  it('uses the default 30 second request timeout and clears its timer', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error('timeout')),
            {once: true},
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      let finished = false;
      const result = createChooser()(TEXT, TEXT, CANDIDATES).catch(
        (error: unknown) => {
          finished = true;
          return error;
        },
      );
      await vi.advanceTimersByTimeAsync(29_999);
      expect(finished).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await result).toBeInstanceOf(Error);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it('preserves every character of the Korean prompt and ChatML wrapping', () => {
    expect(buildPrompt(TEXT, '처음 말', TEXT)).toBe(COPIBLE_PROMPT);
  });

  it('posts the exact completion body and averages swapped comparisons against the original holder', async () => {
    const requests: unknown[] = [];
    const probabilities = [0.9, 0.5, 0.6, 0.1];
    const {endpoint} = await startMockLlm(async (request, response) => {
      expect(request.url).toBe('/completion');
      expect(request.method).toBe('POST');
      expect(request.headers['content-type']).toBe('application/json');
      requests.push(await readMockLlmBody(request));
      response.end(
        JSON.stringify({
          completion_probabilities: [
            {probs: [{tok_str: '1', prob: probabilities.shift()}]},
          ],
        }),
      );
    });
    expect(await createChooser({endpoint})(TEXT, TEXT, CANDIDATES)).toBe(2);
    const pairs = [
      [CANDIDATES[1], CANDIDATES[0]],
      [CANDIDATES[0], CANDIDATES[1]],
      [CANDIDATES[2], CANDIDATES[0]],
      [CANDIDATES[0], CANDIDATES[2]],
    ];
    expect(requests).toEqual(
      pairs.map(([first = '', second = '']) => ({
        prompt: buildPrompt(TEXT, first, second),
        n_predict: 1,
        temperature: 0,
        top_k: 1,
        n_probs: 4,
        grammar: 'root ::= "1" | "2"',
        cache_prompt: true,
        stop: ['<|im_end|>'],
      })),
    );
  });

  it.each([
    [
      'probs',
      {
        completion_probabilities: [{probs: [{tok_str: ' 1', prob: 0.8}]}],
        content: '2',
      },
    ],
    [
      'top_logprobs',
      {
        completion_probabilities: [
          {top_logprobs: [{token: '1 ', logprob: Math.log(0.8)}]},
        ],
        content: '2',
      },
    ],
    [
      'prob before logprob',
      {
        completion_probabilities: [
          {probs: [{token: '1', prob: 0.8, logprob: Math.log(0.1)}]},
        ],
      },
    ],
    ['content fallback', {content: ' 1\n'}],
    [
      'unlisted token fallback',
      {
        content: '1',
        completion_probabilities: [{probs: [{token: '2', prob: 0.9}]}],
      },
    ],
  ])('reads %s', async (_name, first) => {
    const replies = [
      first,
      {
        content: '1',
        completion_probabilities: [
          {top_logprobs: [{token: '1', logprob: Math.log(0.7)}]},
        ],
      },
    ];
    const {endpoint} = await startMockLlm((_request, response) =>
      response.end(JSON.stringify(replies.shift())),
    );
    expect(
      await createChooser({endpoint})(TEXT, TEXT, CANDIDATES.slice(0, 2)),
    ).toBe(1);
  });

  it('keeps rules below 0.5 and chooses the last challenger on equal averages', async () => {
    let probabilities = [0.8, 0.9];
    const {endpoint} = await startMockLlm((_request, response) =>
      response.end(
        JSON.stringify({
          completion_probabilities: [
            {probs: [{tok_str: '1', prob: probabilities.shift()}]},
          ],
        }),
      ),
    );
    const choose = createChooser({endpoint});
    expect(await choose(TEXT, TEXT, CANDIDATES.slice(0, 2))).toBe(0);
    probabilities = [0.75, 0.25, 0.75, 0.25];
    expect(await choose(TEXT, TEXT, CANDIDATES)).toBe(2);
    probabilities = [0.5, 0.5];
    expect(await choose(TEXT, TEXT, CANDIDATES.slice(0, 2))).toBe(1);
  });

  it('uses content 2 or empty content as probability zero and needs no server for one candidate', async () => {
    const replies = [{content: '2'}, {}];
    const {endpoint} = await startMockLlm((_request, response) =>
      response.end(JSON.stringify(replies.shift())),
    );
    expect(
      await createChooser({endpoint})(TEXT, TEXT, CANDIDATES.slice(0, 2)),
    ).toBe(1);
    expect(
      await createChooser({endpoint: 'http://127.0.0.1:0'})(TEXT, TEXT, [TEXT]),
    ).toBe(0);
  });

  it.each(['headers', 'body'])(
    'throws on a timeout waiting for %s',
    async phase => {
      const {endpoint} = await startMockLlm((_request, response) => {
        if (phase === 'body') {
          response.writeHead(200);
          response.write('{');
        }
      });
      await expect(
        createChooser({endpoint, timeoutMs: 20})(TEXT, TEXT, CANDIDATES),
      ).rejects.toThrow();
    },
  );

  it.each(['http', 'json', 'schema'])(
    'throws on %s failures',
    async failure => {
      const {endpoint} = await startMockLlm((_request, response) => {
        response.statusCode = failure === 'http' ? 503 : 200;
        response.end(failure === 'schema' ? '[]' : 'invalid json');
      });
      await expect(
        createChooser({endpoint})(TEXT, TEXT, CANDIDATES),
      ).rejects.toThrow(failure === 'http' ? 'HTTP 503' : undefined);
    },
  );
});
