import {describe, expect, it} from 'vitest';
import {fitAspect} from './fitAspect';

describe('fitAspect', () => {
  it('fills the width of a tall box with a wide layout', () => {
    expect(fitAspect({width: 400, height: 400}, 2)).toEqual({
      width: 400,
      height: 200,
    });
  });

  it('fills the height of a short box with a tall layout', () => {
    expect(fitAspect({width: 400, height: 100}, 0.5)).toEqual({
      width: 50,
      height: 100,
    });
  });

  it('keeps the ratio when the box has exactly that ratio', () => {
    expect(fitAspect({width: 320, height: 180}, 16 / 9)).toEqual({
      width: 320,
      height: 180,
    });
  });
});
