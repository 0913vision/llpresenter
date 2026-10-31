import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {macroActionKinds} from '@core/schema/macros';
import {MacroPalette} from './MacroPalette';
import {
  MACRO_ACTION_MIME,
  MACRO_PALETTE,
  readMacroActionDrag,
  searchMacroPalette,
} from './macroPaletteCatalog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('offers every action kind exactly once in the specified groups', () => {
  const actions = MACRO_PALETTE.flatMap(group =>
    group.actions.map(item => item.kind),
  );
  expect(actions).toHaveLength(macroActionKinds.length);
  expect(new Set(actions)).toEqual(new Set(macroActionKinds));
  expect(MACRO_PALETTE.map(group => group.label)).toEqual([
    '화면',
    '지우기',
    '내용',
    '소리',
    '진행',
  ]);
  expect(searchMacroPalette('   ')).toBe(MACRO_PALETTE);
});

it('filters by search and supports keyboard selection and closing', async () => {
  const choose = vi.fn();
  const close = vi.fn();
  render(<MacroPalette onChoose={choose} onClose={close} />);
  fireEvent.change(screen.getByRole('textbox', {name: '동작 찾기'}), {
    target: {value: '오디오'},
  });
  expect(screen.queryByRole('button', {name: '그래픽'})).toBeNull();
  const group = screen.getByRole('region', {name: '소리'});
  const row = within(group).getByRole('button', {name: '오디오 재생 목록'});
  row.focus();
  await userEvent.keyboard('{Enter}');
  expect(choose).toHaveBeenCalledExactlyOnceWith('audioPlaylist');
  fireEvent.click(screen.getByRole('button', {name: '동작 팔레트 닫기'}));
  expect(close).toHaveBeenCalledOnce();
});

it('writes a recognized drag kind and rejects unknown external values', () => {
  render(<MacroPalette onChoose={() => undefined} onClose={() => undefined} />);
  const setData = vi.fn();
  const transfer = {setData, effectAllowed: ''};
  fireEvent.dragStart(screen.getByRole('button', {name: '그래픽'}), {
    dataTransfer: transfer,
  });
  expect(setData).toHaveBeenCalledExactlyOnceWith(MACRO_ACTION_MIME, 'prop');
  expect(transfer.effectAllowed).toBe('copy');
  expect(readMacroActionDrag('prop')).toBe('prop');
  expect(readMacroActionDrag('prop\nother')).toBeUndefined();
  expect(readMacroActionDrag('unrecognized')).toBeUndefined();
});
