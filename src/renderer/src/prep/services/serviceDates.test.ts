import {describe, expect, it} from 'vitest';
import {dateLabel, localDate, timeChoices, timeLabel} from './serviceDates';

const monday = new Date(2026, 9, 26, 8, 40);

describe('service dates', () => {
  it('writes a local date and shows it with its weekday', () => {
    expect(localDate(monday)).toBe('2026-10-26');
    expect(dateLabel('2026-10-25')).toBe('10월 25일 일요일');
    expect(dateLabel('2026-11-01')).toBe('11월 1일 일요일');
  });

  it('shows times in the 12-hour clock', () => {
    expect(timeLabel('00:00')).toBe('오전 12:00');
    expect(timeLabel('11:00')).toBe('오전 11:00');
    expect(timeLabel('12:30')).toBe('오후 12:30');
    expect(timeLabel('18:05')).toBe('오후 6:05');
  });

  it('formats early years as civil dates and leaves invalid labels readable', () => {
    expect(dateLabel('0001-01-01')).toBe('1월 1일 월요일');
    expect(dateLabel('invalid')).toBe('invalid');
  });

  it('offers 30-minute steps and keeps a time between them', () => {
    expect(timeChoices('11:00')).toHaveLength(48);
    const values = timeChoices('11:15').map(choice => choice.value);
    expect(values).toHaveLength(49);
    expect(values.slice(22, 25)).toEqual(['11:00', '11:15', '11:30']);
  });
});
