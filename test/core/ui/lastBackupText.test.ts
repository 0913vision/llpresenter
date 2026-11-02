import {expect, it} from 'vitest';
import {lastBackupText} from '@core/ui/lastBackupText';

const now = new Date(2026, 10, 2, 15, 30);
const at = (month: number, day: number, time: string) => {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return new Date(2026, month, day, hour, minute).getTime();
};

it('writes 없음 when there is no backup', () => {
  expect(lastBackupText(null, now)).toBe('없음');
});

it('writes a backup of today with the time', () => {
  expect(lastBackupText(at(10, 2, '07:58'), now)).toBe('오늘 07:58');
});

it('writes yesterday and older days', () => {
  expect(lastBackupText(at(10, 1, '23:05'), now)).toBe('어제 23:05');
  expect(lastBackupText(at(9, 31, '08:00'), now)).toBe('10월 31일 08:00');
});
