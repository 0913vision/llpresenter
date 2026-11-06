import {parseLlmCompletion} from '@core/schema/llmResponse';
import {DEFAULT_ENDPOINT, fetchJson} from './http';

const SYSTEM_PROMPT = `당신은 한국어 성경 한 절을 예배용 슬라이드 두 장에 나눠 담습니다.

같은 절을 두 가지 방법으로 나눈 것을 보여드립니다. 절이 원래 나뉘는 자리에서
끊은 쪽을 고르세요. 1 또는 2만 적으세요.`;
const REQUEST_TIMEOUT_MS = 30_000;

function slideOf(label: string, remaining: string, candidate: string): string {
  const rest = remaining.slice(candidate.length).trim();
  return `${label}\n  앞장: ${candidate}\n  뒷장: ${rest || '(없음)'}`;
}

/** Copible 1.6's Korean prompt and ChatML framing, without normalization. */
export function buildPrompt(remaining: string, first: string, second: string) {
  const user = `${slideOf('1번', remaining, first)}\n\n${slideOf('2번', remaining, second)}`;
  return (
    `<|im_start|>system\n${SYSTEM_PROMPT}<|im_end|>\n` +
    `<|im_start|>user\n${user}<|im_end|>\n` +
    '<|im_start|>assistant\n'
  );
}

function readFirstWinsProb(value: unknown): number {
  const parsed = parseLlmCompletion(value);
  if (!parsed.ok) throw new Error('Invalid LLM completion response');
  const body = parsed.value;
  const slot = body.completion_probabilities?.[0];
  for (const entry of slot?.probs ?? slot?.top_logprobs ?? []) {
    const token = (entry.tok_str ?? entry.token ?? '').trim();
    const probability =
      entry.prob ??
      (typeof entry.logprob === 'number' ? Math.exp(entry.logprob) : null);
    if (token === '1' && probability !== null) return probability;
  }
  return (body.content ?? '').trim() === '1' ? 1 : 0;
}

/** Each challenger faces the original rule winner twice, as in Copible 1.6. */
export function createChooser({
  endpoint = DEFAULT_ENDPOINT,
  timeoutMs = REQUEST_TIMEOUT_MS,
  signal,
}: {
  readonly endpoint?: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
} = {}) {
  const askFirstWins = async (
    remaining: string,
    first: string,
    second: string,
  ): Promise<number> => {
    const body = await fetchJson({
      url: `${endpoint}/completion`,
      init: {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          prompt: buildPrompt(remaining, first, second),
          n_predict: 1,
          temperature: 0,
          top_k: 1,
          n_probs: 4,
          grammar: 'root ::= "1" | "2"',
          cache_prompt: true,
          stop: ['<|im_end|>'],
        }),
      },
      timeoutMs,
      signal,
    });
    return readFirstWinsProb(body);
  };
  return async (
    _fullText: string,
    remaining: string,
    candidates: readonly string[],
  ): Promise<number> => {
    signal?.throwIfAborted();
    const holder = candidates[0];
    if (holder === undefined || candidates.length <= 1) return 0;
    let bestIndex = 0;
    let bestPref = 0.5;
    for (let i = 1; i < candidates.length; i++) {
      const challenger = candidates[i];
      if (challenger === undefined) continue;
      const asFirst = await askFirstWins(remaining, challenger, holder);
      const asSecond = 1 - (await askFirstWins(remaining, holder, challenger));
      const pref = (asFirst + asSecond) / 2;
      if (pref >= bestPref) {
        bestPref = pref;
        bestIndex = i;
      }
    }
    return bestIndex;
  };
}
