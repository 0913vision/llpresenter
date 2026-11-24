import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {MenuBar} from '@renderer/app/shell/menubar/MenuBar';
import {
  fullScreenRow,
  useFullScreen,
} from '@renderer/app/shell/menubar/viewToggles';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {NOT_YET} from '@renderer/ui/menus/menuRows';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  resetTooltips();
  cleanup();
  delete window.llp;
});

describe('보기 › 전체 화면', () => {
  it('reads the state, follows main, and toggles through the window action', async () => {
    const control = vi.fn();
    let follow: (on: boolean) => void = () => undefined;
    const stop = vi.fn();
    window.llp = mockLlpApi({
      window: {
        control,
        fullScreen: () => Promise.resolve(true),
        onFullScreen: listener => {
          follow = listener;
          return stop;
        },
      },
    });
    const {result, unmount} = renderHook(() => useFullScreen());
    await act(() => Promise.resolve());
    expect(result.current).toBe(true);
    act(() => follow(false));
    expect(result.current).toBe(false);

    const row = fullScreenRow(result.current);
    expect(row).toMatchObject({check: 'checkbox', checked: false});
    row.onSelect?.();
    expect(control).toHaveBeenCalledExactlyOnceWith('toggle-full-screen');
    unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
});

describe('파일 › 새 곡', () => {
  it('runs the same handler from the row and from Ctrl N, and is off without one', async () => {
    window.llp = mockLlpApi({});
    const onNewSong = vi.fn();
    const user = userEvent.setup();
    const view = render(<MenuBar title="" onNewSong={onNewSong} />);
    await user.click(screen.getByRole('menuitem', {name: '파일'}));
    const menu = screen.getByRole('menu', {name: '파일'});
    const row = within(menu).getByRole('menuitem', {name: /^새 곡/});
    expect(row.getAttribute('aria-disabled')).toBeNull();
    expect(row.textContent).toContain('Ctrl N');
    await user.click(row);
    expect(onNewSong).toHaveBeenCalledOnce();

    fireEvent.keyDown(window, {key: 'n', code: 'KeyN', ctrlKey: true});
    expect(onNewSong).toHaveBeenCalledTimes(2);

    view.rerender(<MenuBar title="" />);
    await user.click(screen.getByRole('menuitem', {name: '파일'}));
    const off = within(screen.getByRole('menu', {name: '파일'})).getByRole(
      'menuitem',
      {name: /^새 곡/},
    );
    expect(off.getAttribute('aria-disabled')).toBe('true');
    expect((await hoverForTooltip(off))?.textContent).toBe(NOT_YET);
  });
});
