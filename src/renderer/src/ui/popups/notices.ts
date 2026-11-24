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
  /** Keeps an in-progress notice available until it is replaced or dismissed. */
  readonly persistent?: boolean | undefined;
  /**
   * A warning about one action that failed, which closes by itself like an
   * information card, only later; a warning about a lasting problem stays.
   */
  readonly passing?: boolean | undefined;
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

/**
 * A warning card made now, such as 예배 저장 실패 with the names it is about:
 * every part of the app reports a failure with this.
 */
export function warningNotice(
  key: string,
  title: string,
  meta?: readonly string[],
): Notice {
  return {
    key,
    kind: 'warning',
    icon: 'warning',
    title,
    time: noticeTime(),
    passing: true,
    ...(meta === undefined ? {} : {meta}),
  };
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

/** One line of the 알림 기록: a notice as it last showed. */
export interface NoticeRecord {
  /** Tells apart records with the same cause. */
  readonly id: number;
  readonly key: string;
  readonly kind: NoticeKind;
  readonly icon: string;
  readonly title: string;
  readonly time: string;
  readonly meta?: readonly string[] | undefined;
  /** Whether its card was closed; a closed record is never rewritten. */
  readonly closed: boolean;
}

/** The most records the 알림 기록 keeps; the oldest go first. */
export const MAX_NOTICE_RECORDS = 100;

/**
 * Writes a notice into the history, newest first. A notice that updates a card
 * still open with the same cause and kind, such as a progress count, rewrites
 * that card's record; anything else, such as a lost monitor found again, adds
 * a record.
 */
export function recordNotice(
  records: readonly NoticeRecord[],
  notice: Notice,
  id: number,
): readonly NoticeRecord[] {
  const last = records.find(record => record.key === notice.key);
  const rewrites = last?.closed === false && last.kind === notice.kind;
  const record: NoticeRecord = {
    id,
    key: notice.key,
    kind: notice.kind,
    icon: notice.icon,
    title: notice.title,
    time: notice.time,
    meta: notice.meta,
    closed: false,
  };
  const rest = rewrites ? records.filter(old => old !== last) : records;
  return [record, ...rest].slice(0, MAX_NOTICE_RECORDS);
}

/** Marks the newest record of that cause as closed, once its card closes. */
export function closeRecord(
  records: readonly NoticeRecord[],
  key: string,
): readonly NoticeRecord[] {
  const last = records.find(record => record.key === key);
  if (last === undefined || last.closed) return records;
  return records.map(record =>
    record === last ? {...record, closed: true} : record,
  );
}
