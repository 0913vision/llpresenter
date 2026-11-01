import {describe, expect, it} from 'vitest';
import {stageClockText} from './stageClock';

const WALL = new Date(2026, 9, 26, 9, 5, 7).getTime();

describe('stageClockText', () => {
  it('reads the 24-hour time with two-digit hours and minutes', () => {
    expect(stageClockText(WALL)).toBe('09:05');
    expect(stageClockText(new Date(2026, 9, 26, 23, 59, 59).getTime())).toBe(
      '23:59',
    );
  });
  it.each([
    {hours: 0, text: '오전 12:05'},
    {hours: 9, text: '오전 9:05'},
    {hours: 12, text: '오후 12:05'},
    {hours: 13, text: '오후 1:05'},
    {hours: 23, text: '오후 11:05'},
  ])('formats the 12-hour boundary at $hours', ({hours, text}) => {
    expect(
      stageClockText(new Date(2026, 9, 26, hours, 5).getTime(), '12h'),
    ).toBe(text);
  });
});
