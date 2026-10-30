import {describe, expect, it} from 'vitest';
import {NOT_YET, laterClipboardRows, laterRow, menuSeparator} from './menuRows';

describe('laterRow', () => {
  it('is a disabled row that says the feature is not here yet', () => {
    expect(laterRow('cut', '잘라내기', {icon: 'scissors'})).toEqual({
      kind: 'item',
      id: 'cut',
      label: '잘라내기',
      icon: 'scissors',
      meta: undefined,
      disabled: true,
      title: NOT_YET,
      submenu: undefined,
    });
  });

  it('draws a submenu arrow without opening anything', () => {
    expect(laterRow('auto', '자동 지우기', {submenu: true}).submenu).toEqual(
      [],
    );
  });
});

describe('laterClipboardRows', () => {
  it('gives ProPresenter cut, copy, and paste with their icons', () => {
    expect(
      laterClipboardRows().map(row => [row.label, row.icon, row.disabled]),
    ).toEqual([
      ['잘라내기', 'scissors', true],
      ['복사', 'copy', true],
      ['붙여넣기', 'paste', true],
    ]);
  });
});

describe('menuSeparator', () => {
  it('makes a divider entry', () => {
    expect(menuSeparator('a')).toEqual({kind: 'separator', id: 'a'});
  });
});
