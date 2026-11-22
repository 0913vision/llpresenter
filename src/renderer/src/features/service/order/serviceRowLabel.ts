import type {ItemRow} from '@core/presentation';

/** Names title-less items without adding a visible or saved title. */
export function serviceRowLabel(row: ItemRow, position: number): string {
  if (row.title.trim() !== '') return row.title;
  const kind =
    row.kind === 'notice'
      ? '광고'
      : row.kind === 'blank'
        ? '빈 슬라이드'
        : '항목';
  return `${kind} ${position}`;
}
