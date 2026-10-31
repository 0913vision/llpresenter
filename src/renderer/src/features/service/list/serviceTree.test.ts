import {describe, expect, it} from 'vitest';
import {parseService} from '@core/schema/service';
import {
  allState,
  checkAll,
  itemCount,
  rowState,
  selectedIds,
  toggleRow,
  treePosition,
  treeRows,
  type TreeRow,
} from './serviceTree';
import {
  ids,
  legacyTemplateDocument,
  otherItems,
  pastDocument,
  songTitles,
  templateOrder,
  titles,
} from '@core/testing/serviceList';

const rows = treeRows(templateOrder, songTitles);

function row(id: string): TreeRow {
  const found = rows.find(candidate => candidate.id === id);
  if (found === undefined) throw new Error(`No row ${id}`);
  return found;
}

describe('treeRows', () => {
  it('reads legacy service slots as top-level empty sections', () => {
    const parsed = parseService(
      JSON.stringify({
        ...pastDocument.service,
        order: [
          {id: ids.offering, slot: 'slides', title: '헌금 찬양'},
          {id: ids.closing, slot: 'bible', title: '광고'},
        ],
      }),
      'past.llservice',
    );
    if (!parsed.ok) throw new Error('The legacy service could not be read');
    const legacyRows = treeRows(parsed.value.data.order, songTitles);
    expect(legacyRows).toEqual([
      {id: ids.offering, label: '헌금 찬양', header: true},
      {id: ids.closing, label: '광고', header: true},
    ]);
    expect([...checkAll(legacyRows, true)]).toEqual([
      ids.offering,
      ids.closing,
    ]);
  });

  it('reads a legacy template as independent sections and preserves unknown fields', () => {
    const document = legacyTemplateDocument();
    const legacyRows = treeRows(document.template.order, songTitles);
    expect(legacyRows.slice(-2)).toEqual([
      {id: ids.offering, label: '헌금 찬양', header: true},
      {id: ids.closing, label: '광고', header: true},
    ]);
    expect(document.template.order.at(-2)).toEqual({
      id: ids.offering,
      header: '헌금 찬양',
      future: {keep: true},
    });
    expect(itemCount(legacyRows)).toBe(3);
    expect(
      selectedIds(legacyRows, new Set([ids.closing, ids.offering])),
    ).toEqual([ids.offering, ids.closing]);
  });

  it('labels every kind and puts items under the header before them', () => {
    expect(
      rows.map(({label, icon, detail, header, headerId}) => ({
        label,
        icon,
        detail,
        header,
        headerId,
      })),
    ).toEqual([
      {label: '찬양', header: true},
      {
        label: titles.first,
        icon: 'song',
        detail: '주일용',
        header: false,
        headerId: ids.praise,
      },
      {
        label: titles.second,
        icon: 'song',
        detail: '기본',
        header: false,
        headerId: ids.praise,
      },
      {label: '말씀', header: true},
      {label: '시편 23:1-6', icon: 'book', header: false, headerId: ids.word},
      {
        label: '헌금 찬양',
        header: true,
      },
      {label: '광고', header: true},
    ]);
  });

  it('names media, notices, unknown items, and songs it can not find', () => {
    expect(
      treeRows(otherItems, new Map()).map(({label, icon}) => [label, icon]),
    ).toEqual([
      ['미디어', 'film'],
      ['공지', 'notice'],
      ['알 수 없는 항목', 'filex'],
    ]);
    expect(treeRows(templateOrder, new Map())[1]?.label).toBe(
      '곡을 찾을 수 없음',
    );
  });

  it('places each row among the rows at its level, once per rows array', () => {
    expect(treePosition(rows, row(ids.praise))).toEqual({
      level: 1,
      position: 1,
      size: 4,
    });
    expect(treePosition(rows, row(ids.offering))).toEqual({
      level: 1,
      position: 3,
      size: 4,
    });
    expect(treePosition(rows, row(ids.closing))).toEqual({
      level: 1,
      position: 4,
      size: 4,
    });
    expect(treePosition(rows, row(ids.nearer))).toBe(
      treePosition(rows, row(ids.nearer)),
    );
  });

  it('counts items without headers', () => {
    expect(itemCount(rows)).toBe(3);
  });
});

describe('tree selection', () => {
  it('checks every item and every empty header for a full selection', () => {
    const all = checkAll(rows, true);
    expect([...all]).toEqual([
      ids.doxology,
      ids.nearer,
      ids.psalm,
      ids.offering,
      ids.closing,
    ]);
    expect(allState(rows, all)).toBe(true);
    expect(allState(rows, checkAll(rows, false))).toBe(false);
  });

  it('shows a header with some items checked as mixed', () => {
    const selection = toggleRow({
      rows,
      row: row(ids.nearer),
      on: false,
      selection: checkAll(rows, true),
    });
    expect(rowState(rows, row(ids.praise), selection)).toBe('mixed');
    expect(rowState(rows, row(ids.word), selection)).toBe(true);
    expect(rowState(rows, row(ids.nearer), selection)).toBe(false);
    expect(allState(rows, selection)).toBe('mixed');
  });

  it('checks or unchecks the items of a header, and an empty header itself', () => {
    const none = checkAll(rows, false);
    const praise = toggleRow({
      rows,
      row: row(ids.praise),
      on: true,
      selection: none,
    });
    expect([...praise]).toEqual([ids.doxology, ids.nearer]);
    const closing = toggleRow({
      rows,
      row: row(ids.closing),
      on: true,
      selection: praise,
    });
    expect(rowState(rows, row(ids.closing), closing)).toBe(true);
    expect([
      ...toggleRow({rows, row: row(ids.praise), on: false, selection: closing}),
    ]).toEqual([ids.closing]);
  });

  it('gives the checked ids in their order', () => {
    const selection = new Set([ids.closing, ids.psalm, ids.doxology]);
    expect(selectedIds(rows, selection)).toEqual([
      ids.doxology,
      ids.psalm,
      ids.closing,
    ]);
  });
});
