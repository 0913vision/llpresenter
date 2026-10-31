import type {RecoveryRowKind, RecoverySummary} from '@core/schema/recovery';

type Summary = NonNullable<RecoverySummary>;
type Row = Summary['rows'][number];
type ShowingCounts = Extract<Row, {kind: 'showing'}>['counts'];

/** One check row of the 출력 상태 복구 dialog. */
export interface RecoveryRowView {
  readonly kind: RecoveryRowKind;
  readonly icon: string;
  readonly label: string;
  /** What the row would restore, such as 본 화면, 무대 화면. */
  readonly value: string;
}

const showingOrder = [
  ['messages', '메시지'],
  ['props', '그래픽'],
  ['stageMessages', '무대 메시지'],
  ['notices', '공지'],
  ['stageLayouts', '무대 배치'],
] as const satisfies ReadonlyArray<readonly [keyof ShowingCounts, string]>;

function showingValue(counts: ShowingCounts): string {
  return showingOrder
    .flatMap(([key, name]) =>
      counts[key] > 0 ? [`${name} ${counts[key]}`] : [],
    )
    .join(', ');
}

function rowView(row: Row): RecoveryRowView {
  switch (row.kind) {
    case 'outputs':
      return {
        kind: row.kind,
        icon: 'mplay',
        label: '화면 출력',
        value: row.screens.map(screen => screen.name).join(', '),
      };
    case 'slide':
      return {
        kind: row.kind,
        icon: 'slides',
        label: '마지막 슬라이드',
        value: `${row.slide.title}  ${row.slide.position + 1} / ${row.slide.slideCount}`,
      };
    case 'showing':
      return {
        kind: row.kind,
        icon: 'layers',
        label: '표시 중이던 항목',
        value: showingValue(row.counts),
      };
  }
}

/** The dialog's rows, in the order main offers them (spec 08). */
export function recoveryRows(summary: Summary): readonly RecoveryRowView[] {
  return summary.rows.map(rowView);
}

const MINUTE_DIGITS = 2;
const HALF_DAY_HOURS = 12;

/**
 * The time of the record in the dialog's detail line, such as 10월 25일 오전
 * 11:26, in the computer's local time.
 */
export function recoveryTime(savedAt: string): string {
  const date = new Date(savedAt);
  const hours = date.getHours();
  const period = hours < HALF_DAY_HOURS ? '오전' : '오후';
  const hour =
    hours % HALF_DAY_HOURS === 0 ? HALF_DAY_HOURS : hours % HALF_DAY_HOURS;
  const minutes = String(date.getMinutes()).padStart(MINUTE_DIGITS, '0');
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${period} ${hour}:${minutes}`;
}
