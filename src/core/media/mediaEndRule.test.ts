import {describe, expect, it} from 'vitest';
import {mediaLoops} from './mediaEndRule';

describe('visual media end rule', () => {
  it('loops when the end rule is absent or loop and stops only for stop', () => {
    expect(mediaLoops({})).toBe(true);
    expect(mediaLoops({props: {}})).toBe(true);
    expect(mediaLoops({props: {end: 'loop'}})).toBe(true);
    expect(mediaLoops({props: {end: 'stop'}})).toBe(false);
  });
});
