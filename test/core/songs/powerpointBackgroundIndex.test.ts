import {describe, expect, it} from 'vitest';
import {powerpointBackgroundIndex} from '@core/songs/powerpointBackgroundIndex';

describe('PowerPoint background vote', () => {
  it('chooses the first occurrence of the most common key', () => {
    expect(
      powerpointBackgroundIndex([
        {background: 'a'},
        {background: null},
        {background: 'b'},
        {background: 'b'},
        {background: 'a'},
        {background: 'b'},
      ]),
    ).toBe(2);
  });
  it('breaks ties by first occurrence and ignores missing backgrounds', () => {
    expect(
      powerpointBackgroundIndex([
        {background: null},
        {background: 'a'},
        {background: 'b'},
      ]),
    ).toBe(1);
    expect(powerpointBackgroundIndex([{background: null}])).toBeUndefined();
  });
});
