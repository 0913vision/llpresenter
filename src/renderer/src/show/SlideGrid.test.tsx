import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {openItem, useShow} from '@renderer/state/show';
import {SlideGrid} from './SlideGrid';
import {seedSampleService} from './testing/sampleService';

beforeEach(() => {
  seedSampleService();
  openItem('song-morning');
  window.llp = fakeLlpApi();
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

function slide(index: number): HTMLElement {
  const tile = screen.getAllByRole('option')[index];
  if (!tile) throw new Error('Missing slide');
  return tile;
}

it('lists the slide menu rows in spec order with only editing enabled', () => {
  render(<SlideGrid columns={4} scalePercent={100} onOpenPrep={vi.fn()} />);
  fireEvent.contextMenu(slide(1));
  const menu = screen.getByRole('menu', {name: '슬라이드'});
  expect(
    [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
      row => (row.getAttribute('role') === 'separator' ? '|' : row.textContent),
    ),
  ).toEqual([
    '빠른 편집',
    '슬라이드 편집',
    '|',
    '사용 안 함',
    '|',
    '테마',
    '전환 효과…',
    '단축키…',
    '다음 타이머로 넘기기…',
    '|',
    '동작 추가',
    '미디어 동작 추가…',
    '|',
    '이름표',
    '슬라이드 이름',
    '|',
    '글자 모양 복사',
    '글자 모양 붙여넣기',
    '|',
    '잘라내기',
    '복사',
    '붙여넣기',
    '삭제',
  ]);
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .filter(row => row.getAttribute('aria-disabled') !== 'true')
      .map(row => row.textContent),
  ).toEqual(['슬라이드 편집']);
  expect(useShow.getState().selectedTile).toBe(0);
});

it.each([{key: 'ContextMenu'}, {key: 'F10', shiftKey: true}])(
  'opens from $key and edits that slide without output',
  keys => {
    const onOpenPrep = vi.fn();
    const send = vi.fn();
    window.llp = fakeLlpApi({live: {send}});
    render(
      <SlideGrid columns={4} scalePercent={100} onOpenPrep={onOpenPrep} />,
    );
    const tile = slide(2);
    tile.focus();
    fireEvent.keyDown(tile, keys);
    fireEvent.click(screen.getByRole('menuitem', {name: '슬라이드 편집'}));
    expect(onOpenPrep).toHaveBeenCalledExactlyOnceWith('song-morning', 2);
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  },
);

it('closes on Escape and returns focus to the slide', () => {
  render(<SlideGrid columns={4} scalePercent={100} />);
  const tile = slide(0);
  tile.focus();
  fireEvent.keyDown(tile, {key: 'ContextMenu'});
  fireEvent.keyDown(screen.getByRole('menu'), {key: 'Escape'});
  expect(document.activeElement).toBe(tile);
});

it('cannot edit the old item after the open item changes', () => {
  const onOpenPrep = vi.fn();
  render(<SlideGrid columns={4} scalePercent={100} onOpenPrep={onOpenPrep} />);
  fireEvent.contextMenu(slide(0));
  act(() => openItem('song-river'));
  expect(screen.queryByRole('menu')).toBeNull();
  expect(onOpenPrep).not.toHaveBeenCalled();
});
