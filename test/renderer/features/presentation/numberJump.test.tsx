import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {openItem, useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {SlideGrid} from '@renderer/features/presentation/SlideGrid';
import {useNumberJumpKeys} from '@renderer/features/presentation/numberJump';
import {useSlideHotKeys} from '@renderer/features/presentation/useSlideHotKeys';
import type {LiveCommand} from '@core/live/commands';
import {
  serviceSlideAt,
  serviceSlideOffset,
} from '@renderer/features/presentation/serviceSlideNumbers';

function Harness() {
  useNumberJumpKeys();
  useSlideHotKeys();
  return (
    <>
      <input aria-label="입력" />
      <SlideGrid columns={3} scalePercent={100} />
    </>
  );
}
const send = vi.fn<(command: LiveCommand) => void>();
beforeEach(() => {
  seedSampleService();
  useLive.setState({state: null});
  openItem('song-morning');
  send.mockClear();
  window.llp = mockLlpApi({live: {send}});
});
afterEach(() => {
  cleanup();
  delete window.llp;
});
const key = (value: string) =>
  fireEvent.keyDown(window, {
    key: value,
    code: /^\d$/u.test(value) ? `Digit${value}` : value,
  });

it('numbers tiles across items and jumps to the same slide as a click', () => {
  render(<Harness />);
  expect(screen.getAllByRole('option')[0]?.getAttribute('aria-label')).toMatch(
    /^2 /u,
  );
  key('6');
  expect(screen.getByRole('status').textContent).toBe('슬라이드 6');
  expect(send).not.toHaveBeenCalled();
  key('Enter');
  expect(screen.queryByRole('status')).toBeNull();
  expect(useShow.getState()).toMatchObject({
    openItemId: 'song-river',
    selectedTile: 0,
  });
  expect(screen.getAllByRole('option')[0]?.getAttribute('aria-label')).toMatch(
    /^6 /u,
  );
  const sent = send.mock.calls.flatMap(([command]) =>
    command.type === 'live.batch' ? command.commands : [command],
  );
  expect(
    sent.some(
      command =>
        command.type === 'slide.show' &&
        command.slide.itemId === 'song-river' &&
        command.slide.position === 0,
    ),
  ).toBe(true);
});

it('edits and cancels pending digits while preserving text editing and other keys', () => {
  render(<Harness />);
  key('1');
  key('2');
  key('Backspace');
  expect(screen.getByRole('status').textContent).toBe('슬라이드 1');
  key('Delete');
  expect(screen.queryByRole('status')).toBeNull();
  key('9');
  key('9');
  key('Enter');
  expect(send).not.toHaveBeenCalled();
  key('2');
  key('Escape');
  expect(screen.queryByRole('status')).toBeNull();
  key('3');
  expect(key('ArrowRight')).toBe(true);
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.keyDown(screen.getByRole('textbox'), {key: '4', code: 'Digit4'});
  expect(screen.queryByRole('status')).toBeNull();
  const menu = document.createElement('div');
  menu.setAttribute('role', 'menu');
  document.body.append(menu);
  key('4');
  expect(screen.queryByRole('status')).toBeNull();
  menu.remove();
});

it('builds multi-digit numbers without firing a digit slide hotkey', () => {
  render(<Harness />);
  key('1');
  expect(send).not.toHaveBeenCalled();
  key('0');
  expect(screen.getByRole('status').textContent).toBe('슬라이드 10');
  key('Enter');
  expect(useShow.getState()).toMatchObject({
    openItemId: 'psalm-23',
    selectedTile: 1,
  });
});

it('recalculates positions when service order and tile counts change', () => {
  const view = useShow.getState();
  expect(serviceSlideAt(view, 6)).toEqual({itemId: 'song-river', index: 0});
  const song = view.rows.find(row => row.id === 'song-river');
  if (!song) throw Error('Missing item');
  const changed = {
    ...view,
    rows: [song, ...view.rows.filter(row => row.id !== song.id)],
    tiles: {
      ...view.tiles,
      'song-river': (view.tiles['song-river'] ?? []).slice(0, 2),
    },
  };
  expect(serviceSlideAt(changed, 3)).toEqual({itemId: 'countdown', index: 0});
  expect(serviceSlideOffset(changed, 'song-morning')).toBe(3);
});
