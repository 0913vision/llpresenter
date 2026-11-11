/** How often a shown clock or running 타이머 redraws. */
export const STAGE_TICK_MS = 1000;

type ClockFormat = '24h' | '12h';

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** Formats a stage clock element, defaulting to 24-hour time. */
export function stageClockText(
  wall: number,
  format: ClockFormat = '24h',
  seconds = false,
): string {
  const date = new Date(wall);
  const hours = date.getHours(),
    minutes = twoDigits(date.getMinutes());
  const suffix = seconds ? `:${twoDigits(date.getSeconds())}` : '';
  return format === '12h'
    ? `${hours < 12 ? '오전' : '오후'} ${hours % 12 || 12}:${minutes}${suffix}`
    : `${twoDigits(hours)}:${minutes}${suffix}`;
}
