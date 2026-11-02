const NONE = '없음';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function clock(time: Date): string {
  return `${twoDigits(time.getHours())}:${twoDigits(time.getMinutes())}`;
}

function startOfDay(time: Date): number {
  return new Date(
    time.getFullYear(),
    time.getMonth(),
    time.getDate(),
  ).getTime();
}

/**
 * The time of the newest backup as 환경설정 shows it: "오늘 07:58", "어제
 * 07:58", or "10월 31일 07:58"; 없음 when there is none.
 */
export function lastBackupText(lastBackup: number | null, now: Date): string {
  if (lastBackup === null) return NONE;
  const time = new Date(lastBackup);
  const days = Math.round((startOfDay(now) - startOfDay(time)) / MS_PER_DAY);
  if (days === 0) return `오늘 ${clock(time)}`;
  if (days === 1) return `어제 ${clock(time)}`;
  return `${time.getMonth() + 1}월 ${time.getDate()}일 ${clock(time)}`;
}
