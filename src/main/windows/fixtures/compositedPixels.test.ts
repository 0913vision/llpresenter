import {afterEach, expect, it, vi} from 'vitest';
import {
  COMPOSITED_FRAME_DEADLINE_MS,
  FRAME_CAPTURE_POLL_MS,
  waitForCompositedPixels,
  type PixelSample,
} from './compositedPixels.mts';

const expected = {transparent: 100, translucent: 150, opaque: 200};
const ready: PixelSample = {
  transparent: [100, 100, 100],
  translucent: [150, 150, 150],
  opaque: [200, 200, 200],
};
const black: PixelSample = {
  transparent: [0, 0, 0],
  translucent: [0, 0, 0],
  opaque: [0, 0, 0],
};

afterEach(() => vi.useRealTimers());

it('accepts a matching first capture and clears its deadline', async () => {
  vi.useFakeTimers();
  const capture = vi.fn(async () => ready);
  await expect(
    waitForCompositedPixels({capture, expected, phase: 'output opacity 0.5'}),
  ).resolves.toBe(ready);
  expect(capture).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('polls stale black and partially composited frames before accepting every band', async () => {
  vi.useFakeTimers();
  const capture = vi
    .fn<() => Promise<PixelSample>>()
    .mockResolvedValueOnce(black)
    .mockResolvedValueOnce({...ready, translucent: [200, 200, 200]})
    .mockResolvedValue(ready);
  const result = waitForCompositedPixels({
    capture,
    expected,
    phase: 'output opacity 0.5',
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(capture).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(FRAME_CAPTURE_POLL_MS);
  expect(capture).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(FRAME_CAPTURE_POLL_MS);
  await expect(result).resolves.toBe(ready);
  expect(capture).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps the original one-byte channel tolerance', async () => {
  vi.useFakeTimers();
  const sample = {
    transparent: [99, 100, 101],
    translucent: [149, 150, 151],
    opaque: [199, 200, 201],
  };
  await expect(
    waitForCompositedPixels({
      capture: async () => sample,
      expected,
      phase: 'preview opacity 0.5',
    }),
  ).resolves.toBe(sample);
  expect(vi.getTimerCount()).toBe(0);
});

it('expires with the phase and last observed values instead of accepting wrong CSS', async () => {
  vi.useFakeTimers();
  const outgoing = {...ready, transparent: [200, 200, 200]};
  const capture = vi
    .fn<() => Promise<PixelSample>>()
    .mockResolvedValueOnce(black)
    .mockResolvedValue(outgoing);
  const result = waitForCompositedPixels({
    capture,
    expected,
    phase: 'output opacity 0.5',
  });
  const failure = expect(result).rejects.toThrow(
    `output opacity 0.5: no matching composited frame within ${COMPOSITED_FRAME_DEADLINE_MS} ms; last pixels: transparent: expected 100, received [200, 200, 200]; translucent: expected 150, received [150, 150, 150]; opaque: expected 200, received [200, 200, 200]`,
  );
  await vi.advanceTimersByTimeAsync(COMPOSITED_FRAME_DEADLINE_MS);
  await failure;
  expect(capture.mock.calls.length).toBeGreaterThan(1);
  expect(vi.getTimerCount()).toBe(0);
});

it.each([{pixel: []}, {pixel: [100, 100]}, {pixel: [100, 100, 102]}])(
  'rejects an incomplete or out-of-tolerance band $pixel',
  async ({pixel}) => {
    vi.useFakeTimers();
    const result = waitForCompositedPixels({
      capture: async () => ({...ready, transparent: pixel}),
      expected,
      phase: 'output opacity 0.5',
    });
    const failure = expect(result).rejects.toThrow('last pixels:');
    await vi.advanceTimersByTimeAsync(COMPOSITED_FRAME_DEADLINE_MS);
    await failure;
    expect(vi.getTimerCount()).toBe(0);
  },
);

it('times out an unfinished capture and never polls after its late resolution', async () => {
  vi.useFakeTimers();
  let resolveCapture: (sample: PixelSample) => void = () => {
    throw new Error('The capture has not started');
  };
  const pending = new Promise<PixelSample>(resolve => {
    resolveCapture = resolve;
  });
  const capture = vi
    .fn<() => Promise<PixelSample>>()
    .mockResolvedValueOnce(black)
    .mockReturnValue(pending);
  const result = waitForCompositedPixels({
    capture,
    expected,
    phase: 'preview after outgoing removal',
  });
  const failure = expect(result).rejects.toThrow(
    'transparent: expected 100, received [0, 0, 0]',
  );
  await vi.advanceTimersByTimeAsync(COMPOSITED_FRAME_DEADLINE_MS);
  await failure;
  expect(capture).toHaveBeenCalledTimes(2);
  resolveCapture(ready);
  await vi.runAllTimersAsync();
  expect(capture).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it('reports that no pixels arrived when the first capture never resolves', async () => {
  vi.useFakeTimers();
  const result = waitForCompositedPixels({
    capture: () => new Promise<PixelSample>(() => {}),
    expected,
    phase: 'output opacity 0',
  });
  const failure = expect(result).rejects.toThrow(
    'transparent: expected 100, received no capture',
  );
  await vi.advanceTimersByTimeAsync(COMPOSITED_FRAME_DEADLINE_MS);
  await failure;
  expect(vi.getTimerCount()).toBe(0);
});

it('propagates capture errors and clears every timer', async () => {
  vi.useFakeTimers();
  const error = new Error('capture failed');
  await expect(
    waitForCompositedPixels({
      capture: async () => {
        throw error;
      },
      expected,
      phase: 'output opacity 0',
    }),
  ).rejects.toBe(error);
  expect(vi.getTimerCount()).toBe(0);
});

it('wraps a non-Error capture failure and clears every timer', async () => {
  vi.useFakeTimers();
  const capture = vi
    .fn<() => Promise<PixelSample>>()
    .mockRejectedValue('capture denied');
  await expect(
    waitForCompositedPixels({capture, expected, phase: 'output opacity 0'}),
  ).rejects.toThrow('capture denied');
  expect(vi.getTimerCount()).toBe(0);
});
