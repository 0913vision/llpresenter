import {describe, expect, it} from 'vitest';
import {
  dateChoices,
  dateLabel,
  localDate,
  timeChoices,
  timeLabel,
} from './serviceDates';

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

  it('offers today and the next 13 days', () => {
    const choices = dateChoices(monday, '2026-10-26');
    expect(choices).toHaveLength(14);
    expect(choices[0]).toEqual({
      value: '2026-10-26',
      label: '10월 26일 월요일',
    });
    expect(choices.at(-1)?.value).toBe('2026-11-08');
  });

  it('keeps a chosen date outside the two weeks, in order', () => {
    const choices = dateChoices(monday, '2026-10-25');
    expect(choices).toHaveLength(15);
    expect(choices[0]?.value).toBe('2026-10-25');
  });

  it('offers 30-minute steps and keeps a time between them', () => {
    expect(timeChoices('11:00')).toHaveLength(48);
    const values = timeChoices('11:15').map(choice => choice.value);
    expect(values).toHaveLength(49);
    expect(values.slice(22, 25)).toEqual(['11:00', '11:15', '11:30']);
  });
});
