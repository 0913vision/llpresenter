import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {
  READY_POLL_MS,
  READY_RECHECK_MS,
  RevealReadiness,
  type RevealOptions,
} from '@renderer/output/revealReadiness';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(overrides: Partial<RevealOptions> = {}) {
  const asked: Array<{version: number; ready: boolean}> = [];
  const answers: Array<(shown: boolean) => void> = [];
  const state = {complete: true, key: 'a', enabled: true};
  const options: RevealOptions = {
    complete: () => state.complete,
    frameKey: () => state.key,
    version: () => 7,
    enabled: () => state.enabled,
    report: frame => {
      asked.push(frame);
      return new Promise<boolean>(resolve => answers.push(resolve));
    },
    onStandbyReady: vi.fn(),
    onShown: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
  return {reveal: new RevealReadiness(options), asked, answers, state, options};
}

it('calls a frame painted only when two animation frames see the same complete drawing', async () => {
  const {reveal, asked, answers} = setup();
  reveal.noteFrame(0);
  expect(asked).toEqual([{version: 7, ready: false}]);
  answers[0]?.(false);
  await vi.advanceTimersByTimeAsync(0);
  reveal.noteFrame(16);
  expect(asked.at(-1)).toEqual({version: 7, ready: true});
});

it('repeats a frame that is not ready at most every recheck interval, one question at a time', async () => {
  const {reveal, asked, answers, state} = setup();
  state.complete = false;
  reveal.noteFrame(0);
  reveal.noteFrame(10);
  expect(asked).toHaveLength(1);
  answers[0]?.(false);
  await vi.advanceTimersByTimeAsync(0);
  reveal.noteFrame(READY_RECHECK_MS - 1);
  expect(asked).toHaveLength(1);
  reveal.noteFrame(READY_RECHECK_MS);
  expect(asked).toHaveLength(2);
});

it('ignores an answer to an older start and keeps asking until main shows the screen', async () => {
  const {reveal, asked, answers, options} = setup();
  reveal.noteFrame(0);
  reveal.noteFrame(16);
  reveal.restart();
  answers[0]?.(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(options.onShown).not.toHaveBeenCalled();
  expect(reveal.isPending).toBe(true);
  reveal.watch();
  await vi.advanceTimersByTimeAsync(READY_POLL_MS);
  expect(asked.at(-1)).toEqual({version: 7, ready: true});
  answers.at(-1)?.(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(options.onShown).toHaveBeenCalledOnce();
  expect(reveal.isPending).toBe(false);
});

it('stops asking once a turned-off screen has its picture ready', async () => {
  const {reveal, asked, answers, state, options} = setup();
  state.enabled = false;
  reveal.noteFrame(0);
  answers.at(-1)?.(false);
  await vi.advanceTimersByTimeAsync(0);
  reveal.noteFrame(16);
  expect(asked.at(-1)).toEqual({version: 7, ready: true});
  reveal.watch();
  answers.at(-1)?.(false);
  await vi.advanceTimersByTimeAsync(0);
  expect(options.onStandbyReady).toHaveBeenCalledOnce();
  const count = asked.length;
  await vi.advanceTimersByTimeAsync(READY_POLL_MS * 5);
  expect(asked).toHaveLength(count);
  expect(vi.getTimerCount()).toBe(0);
});
