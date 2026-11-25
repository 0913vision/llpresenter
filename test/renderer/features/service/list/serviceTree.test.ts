import {describe, expect, it} from 'vitest';
import {createServiceItemId} from '@core/schema/common/ids';
import {
  allState,
  checkAll,
  rowState,
  selectedIds,
  toggleRow,
  treePosition,
  type TreeRow,
} from '@renderer/features/service/list/serviceTree';

function id(index: number) {
  return createServiceItemId(
    `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  );
}

const ALONE = id(1);
const FIRST_PART = id(2);
const SONG = id(3);
const PRAYER = id(4);
const EMPTY_PART = id(5);

const rows: readonly TreeRow[] = [
  {id: ALONE, header: false, label: '예배 전 찬양'},
  {id: FIRST_PART, header: true, label: '1부'},
  {id: SONG, header: false, label: '찬양', headerId: FIRST_PART},
  {id: PRAYER, header: false, label: '기도', headerId: FIRST_PART},
  {id: EMPTY_PART, header: true, label: '2부'},
];
function row(wanted: ReturnType<typeof id>): TreeRow {
  const found = rows.find(entry => entry.id === wanted);
  if (found === undefined) throw new Error('Missing row');
  return found;
}

describe('the service tree', () => {
  it('places items under their header at level 2 and the rest at level 1', () => {
    expect(treePosition(rows, row(ALONE))).toEqual({
      level: 1,
      position: 1,
      size: 3,
    });
    expect(treePosition(rows, row(PRAYER))).toEqual({
      level: 2,
      position: 2,
      size: 2,
    });
    expect(treePosition(rows, row(EMPTY_PART))).toEqual({
      level: 1,
      position: 3,
      size: 3,
    });
  });

  it('checks a header with items through its items, and shows it mixed when some are checked', () => {
    const one = toggleRow({
      rows,
      row: row(SONG),
      on: true,
      selection: new Set(),
    });
    expect(rowState(rows, row(FIRST_PART), one)).toBe('mixed');

    const all = toggleRow({
      rows,
      row: row(FIRST_PART),
      on: true,
      selection: one,
    });
    expect([...all].sort()).toEqual([SONG, PRAYER].sort());
    expect(rowState(rows, row(FIRST_PART), all)).toBe(true);

    const none = toggleRow({
      rows,
      row: row(FIRST_PART),
      on: false,
      selection: all,
    });
    expect(none.size).toBe(0);
  });

  it('checks a header without items by itself', () => {
    const checked = toggleRow({
      rows,
      row: row(EMPTY_PART),
      on: true,
      selection: new Set(),
    });
    expect(rowState(rows, row(EMPTY_PART), checked)).toBe(true);
    expect([...checked]).toEqual([EMPTY_PART]);
  });

  it('checks every item and every empty header with the check-all box, and gives them in order', () => {
    const everything = checkAll(rows, true);
    expect(allState(rows, everything)).toBe(true);
    expect(selectedIds(rows, everything)).toEqual([
      ALONE,
      SONG,
      PRAYER,
      EMPTY_PART,
    ]);
    expect(allState(rows, new Set([SONG]))).toBe('mixed');
    expect(allState(rows, checkAll(rows, false))).toBe(false);
  });
});
