import {describe, expect, it} from 'vitest';
import {
  dateLabel,
  localDate,
} from '@renderer/features/service/list/serviceDates';

const monday = new Date(2026, 9, 26, 8, 40);

describe('service dates', () => {
  it('writes a local date and shows it with its weekday', () => {
    expect(localDate(monday)).toBe('2026-10-26');
    expect(dateLabel('2026-10-25')).toBe('10월 25일 일요일');
    expect(dateLabel('2026-11-01')).toBe('11월 1일 일요일');
  });

  it('formats early years as civil dates and leaves invalid labels readable', () => {
    expect(dateLabel('0001-01-01')).toBe('1월 1일 월요일');
    expect(dateLabel('invalid')).toBe('invalid');
  });
});
