import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {KeptScreenFrames} from '@renderer/features/presentation/preview/keptScreenFrames';

const kept: KeptScreenFrames[] = [];
afterEach(() => {
  for (const frames of kept.splice(0)) frames.dispose();
});

it('keeps the frames of the screens it is given and lets go of the others', () => {
  const frames = new KeptScreenFrames(mockLlpApi(), vi.fn());
  kept.push(frames);
  frames.keep(['audience', 'stage']);
  const stage = frames.follow('stage', vi.fn());
  expect(stage).not.toBeNull();
  expect(frames.follow('broadcast', vi.fn())).toBeNull();
  frames.keep(['stage']);
  expect(frames.follow('audience', vi.fn())).toBeNull();
  expect(frames.follow('stage', vi.fn())?.frames).toBe(stage?.frames);
});

it('hands the same frames to a preview that comes again', () => {
  const frames = new KeptScreenFrames(mockLlpApi(), vi.fn());
  kept.push(frames);
  frames.keep(['stage']);
  const first = frames.follow('stage', vi.fn());
  first?.stop();
  expect(frames.follow('stage', vi.fn())?.frames).toBe(first?.frames);
});
