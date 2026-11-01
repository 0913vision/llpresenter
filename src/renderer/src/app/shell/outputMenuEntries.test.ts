import {afterEach, expect, it} from 'vitest';
import {STAGE_ID} from '@core/testing/screenDocuments';
import {menuItems} from '@renderer/ui/menuModel';
import {outputMenuFixture as fixture} from '@renderer/platform/testing/outputMenu';
import {outputMenuEntries} from './outputMenuEntries';

afterEach(() => {
  delete window.llp;
});

it.each([false, true])(
  'lists three screen groups before final screen settings with warnings=%s',
  warnings => {
    const {input} = fixture();
    const rows = outputMenuEntries({
      ...input,
      warnings: warnings ? input.warnings : [],
    });
    expect(
      rows.map(row =>
        row.kind === 'separator'
          ? '|'
          : row.kind === 'group'
            ? `[${row.label}]`
            : row.label,
      ),
    ).toEqual([
      '[본 화면]',
      '출력 끄기',
      '테마 바꾸기: 없음',
      '항목 끄기',
      '|',
      '[무대 화면]',
      '출력 켜기',
      '무대 화면: 현재와 다음',
      '무대 배치 편집…',
      '|',
      '[방송 자막]',
      '출력 켜기',
      '방송 설정…',
      ...(warnings ? ['|', '무대 화면 경고 보기'] : []),
      '|',
      '화면 설정…',
    ]);
    expect(
      menuItems(rows)
        .filter(row => row.check === 'checkbox')
        .map(row => row.id),
    ).toEqual([]);
    expect(menuItems(rows).every(row => row.icon === undefined)).toBe(true);
  },
);

it('preserves warning actions', () => {
  const {input, onShowWarning} = fixture();
  const rows = menuItems(outputMenuEntries(input));
  rows.find(row => row.id === `warning:${STAGE_ID}`)?.onSelect?.();
  expect(onShowWarning).toHaveBeenCalledExactlyOnceWith(STAGE_ID);
});
