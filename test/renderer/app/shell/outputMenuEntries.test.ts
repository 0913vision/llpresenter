import {afterEach, expect, it} from 'vitest';
import {STAGE_ID} from '@fixtures/core/screenDocuments';
import {menuItems} from '@renderer/ui/menuModel';
import {outputMenuFixture as fixture} from '@fixtures/renderer/platform/outputMenu';
import {outputMenuEntries} from '@renderer/app/shell/outputMenuEntries';

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
      '[청중 화면]',
      '출력 끄기',
      '테마: 없음',
      '항목 끄기',
      '|',
      '[무대 화면]',
      '출력 켜기',
      '|',
      '[방송 화면]',
      '출력 켜기',
      '방송 설정…',
      ...(warnings ? ['|', '무대 화면 문제 보기'] : []),
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
