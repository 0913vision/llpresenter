type ClockFormat = '24h' | '12h';

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** Formats a stage clock element, defaulting to 24-hour time. */
export function stageClockText(
  wall: number,
  format: ClockFormat = '24h',
  options: boolean | {seconds: boolean; timeZone?: string | undefined} = false,
): string {
  const seconds = typeof options === 'boolean' ? options : options.seconds;
  const timeZone = typeof options === 'boolean' ? undefined : options.timeZone;
  const date = new Date(wall);
  const parts =
    timeZone === undefined
      ? undefined
      : new Intl.DateTimeFormat('en-GB', {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        }).formatToParts(wall);
  const part = (name: string): number =>
    Number(parts?.find(value => value.type === name)?.value);
  const hours = parts === undefined ? date.getHours() : part('hour');
  const minutes = twoDigits(
    parts === undefined ? date.getMinutes() : part('minute'),
  );
  const suffix = seconds
    ? `:${twoDigits(parts === undefined ? date.getSeconds() : part('second'))}`
    : '';
  return format === '12h'
    ? `${hours < 12 ? '오전' : '오후'} ${hours % 12 || 12}:${minutes}${suffix}`
    : `${twoDigits(hours)}:${minutes}${suffix}`;
}
