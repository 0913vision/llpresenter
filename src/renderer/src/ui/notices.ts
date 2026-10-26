/** A warning stays until it is resolved; information closes on its own. */
export type NoticeKind = 'warning' | 'info';

/** One of up to two actions on a notification card, such as 창 보기. */
export interface NoticeAction {
  readonly icon: string;
  /** A verb phrase, such as 모니터 다시 찾기. */
  readonly label: string;
  readonly onSelect: () => void;
}

/** A notification card: something the app reports on its own. */
export interface Notice {
  /** The cause, such as `screen:stage`; a new notice with it replaces the old. */
  readonly key: string;
  readonly kind: NoticeKind;
  /** An 18px icon, such as `plug` for a lost monitor. */
  readonly icon: string;
  /** What happened to what, with no period, such as 무대 모니터 연결 끊김. */
  readonly title: string;
  /** When, in 24-hour time without seconds, such as 11:24. */
  readonly time: string;
  /** The current state, such as 모니터 3 → 창으로 표시 중, one value per entry. */
  readonly meta?: readonly string[] | undefined;
  readonly actions?: readonly NoticeAction[] | undefined;
}

/** The most cards that show at once. */
export const MAX_NOTICES = 3;

const NOTICE_TIME_LENGTH = 'HH:MM'.length;

/** The time a notice shows, in 24-hour time without seconds, such as 11:24. */
export function noticeTime(now: Date = new Date()): string {
  return now.toTimeString().slice(0, NOTICE_TIME_LENGTH);
}

function oldestToDrop(notices: readonly Notice[]): number {
  const oldestInfo = notices.findLastIndex(notice => notice.kind === 'info');
  return oldestInfo >= 0 ? oldestInfo : notices.length - 1;
}

/**
 * Puts a notice on top of the stack, newest first. A notice with the same
 * cause replaces the old card, and beyond three cards the oldest
 * information card closes first, else the oldest card.
 */
export function addNotice(
  notices: readonly Notice[],
  notice: Notice,
): readonly Notice[] {
  const next = [notice, ...notices.filter(old => old.key !== notice.key)];
  while (next.length > MAX_NOTICES) next.splice(oldestToDrop(next), 1);
  return next;
}

/** Takes the card with that cause off the stack. */
export function removeNotice(
  notices: readonly Notice[],
  key: string,
): readonly Notice[] {
  return notices.filter(notice => notice.key !== key);
}
