import {describe, expect, it, vi} from 'vitest';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {sourceMenuEntries} from '@renderer/features/service/list/sourceMenuEntries';

function entries(more: {readonly readOnly?: boolean; readonly open?: boolean}) {
  return sourceMenuEntries({
    readOnly: more.readOnly ?? false,
    open: more.open ?? false,
    onRename: vi.fn(),
    onDelete: vi.fn(),
  });
}

describe('the menu of a 템플릿 or 예배 순서 row', () => {
  it('offers 이름 바꾸기 and 삭제', () => {
    expect(entries({})).toMatchObject([
      {id: 'rename', label: '이름 바꾸기', disabled: false},
      {id: 'delete', label: '삭제', danger: true, disabled: false},
    ]);
  });

  it('takes neither on a file of a newer version, saying why', () => {
    expect(entries({readOnly: true})).toMatchObject([
      {id: 'rename', disabled: true, title: NEWER_FILE_REASON},
      {id: 'delete', disabled: true, title: NEWER_FILE_REASON},
    ]);
  });

  it("can't delete the open 예배 순서", () => {
    expect(entries({open: true})).toMatchObject([
      {id: 'rename', disabled: false},
      {id: 'delete', disabled: true, title: '열린 예배는 삭제할 수 없습니다.'},
    ]);
  });
});
