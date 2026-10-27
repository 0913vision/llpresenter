import {useState} from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import * as v from 'valibot';
import {looksSchema} from '@shared/schema/looks';
import type {LyricStyleId} from '@shared/schema/ids';
import type {Result} from '@shared/result';
import {DEFAULT_LYRIC_STYLE} from '@renderer/render/lyricStyle';
import {resetTooltips} from '@renderer/ui/tooltipTesting';
import {looksDocument} from '../testing/documents';
import {LyricStyleSelector} from './LyricStyleSelector';
import type {
  LyricStyleListEdit,
  LyricStyleListProblem,
} from './lyricStyleListEdits';

afterEach(() => {
  cleanup();
  resetTooltips();
});

function setup(reason?: string) {
  const document = looksDocument();
  if (document.name !== 'looks') throw new Error('Wrong fixture');
  const looks = v.parse(looksSchema, {
    ...document.value,
    lyricStyles: [
      {
        ...DEFAULT_LYRIC_STYLE,
        id: '00000000-0000-4000-8000-000000000301',
        name: '기본',
      },
      {
        ...DEFAULT_LYRIC_STYLE,
        id: '00000000-0000-4000-8000-000000000302',
        name: '다른 스타일',
      },
    ],
  });
  const change = vi
    .fn<
      (
        edit: LyricStyleListEdit,
      ) => Promise<Result<boolean, LyricStyleListProblem>>
    >()
    .mockResolvedValue({ok: true, value: true});
  const select = vi.fn<(id: LyricStyleId) => void>();
  function Fixture() {
    const [value, setValue] = useState(looks.lyricStyles[0]?.id);
    return (
      <LyricStyleSelector
        looks={looks}
        value={value}
        reason={reason}
        onChange={change}
        onProblem={vi.fn()}
        onSelect={id => {
          select(id);
          setValue(id);
        }}
      />
    );
  }
  return {...render(<Fixture />), change, select};
}

it('hands focus from a focused keyboard context menu to rename after cleanup', async () => {
  const {change} = setup();
  const tab = screen.getByRole('tab', {name: '기본'});
  tab.focus();
  fireEvent.keyDown(tab, {key: 'ContextMenu'});
  fireEvent.click(await screen.findByRole('menuitem', {name: '이름 변경'}));
  const field = await screen.findByRole('textbox', {name: '스타일 이름'});
  await waitFor(() => expect(document.activeElement).toBe(field));
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(field, {target: {value: '새 이름'}});
  fireEvent.keyDown(field, {key: 'Enter'});
  expect(change).toHaveBeenCalledWith(
    expect.objectContaining({kind: 'rename', name: '새 이름'}),
  );
});

it('cancels invalid or escaped names without writing', async () => {
  const {change} = setup();
  fireEvent.contextMenu(screen.getByRole('tab', {name: '기본'}));
  fireEvent.click(await screen.findByRole('menuitem', {name: '이름 변경'}));
  const field = await screen.findByRole('textbox', {name: '스타일 이름'});
  fireEvent.change(field, {target: {value: '다른 스타일'}});
  fireEvent.blur(field);
  expect(change).not.toHaveBeenCalled();
});

it('does not steal later navigation when an addition finishes', async () => {
  const {change, select} = setup();
  let release: (result: Result<boolean, LyricStyleListProblem>) => void = () =>
    undefined;
  change.mockReturnValue(
    new Promise(resolve => {
      release = resolve;
    }),
  );
  fireEvent.click(screen.getByRole('button', {name: '새 가사 스타일'}));
  fireEvent.click(screen.getByRole('tab', {name: '다른 스타일'}));
  const previous = select.mock.calls.length;
  await act(async () => release({ok: true, value: true}));
  expect(select).toHaveBeenCalledTimes(previous);
});

it('disables lifecycle actions for read-only settings', async () => {
  const {change} = setup('읽기 전용');
  fireEvent.click(screen.getByRole('button', {name: '새 가사 스타일'}));
  fireEvent.contextMenu(screen.getByRole('tab', {name: '기본'}));
  const rename = await screen.findByRole('menuitem', {name: '이름 변경'});
  expect(rename.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(rename);
  expect(change).not.toHaveBeenCalled();
});
