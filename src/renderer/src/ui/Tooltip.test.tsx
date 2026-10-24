import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Tooltip, ariaShortcut, withTooltipProps} from './Tooltip';
import {
  TOOLTIP_DELAY_MS,
  TOOLTIP_GRACE_MS,
  TooltipController,
} from './tooltipController';
import {
  hoverForTooltip,
  resetTooltips,
  setupTooltipUser,
} from './tooltipTesting';

afterEach(() => {
  cleanup();
  resetTooltips();
});

function ClearLyrics(): React.JSX.Element {
  return (
    <>
      <Tooltip text="가사 지우기" shortcut="F2">
        <button type="button">가사</button>
      </Tooltip>
      <Tooltip text="모두 지우기" shortcut="F1" sub="본 화면, 무대 화면">
        <button type="button">모두</button>
      </Tooltip>
    </>
  );
}

describe('Tooltip', () => {
  it('shows after the pointer rests for 600ms, not before', async () => {
    const user = setupTooltipUser();
    render(<ClearLyrics />);
    await user.hover(screen.getByRole('button', {name: '가사'}));
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_DELAY_MS / 2);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_DELAY_MS / 2);
    });
    expect(screen.getByRole('tooltip').textContent).toBe('가사 지우기F2');
  });

  it('describes its target and gives the shortcut in aria form', async () => {
    const user = setupTooltipUser();
    render(<ClearLyrics />);
    const target = screen.getByRole('button', {name: '가사'});
    expect(target.getAttribute('aria-keyshortcuts')).toBe('F2');
    expect(target.hasAttribute('aria-describedby')).toBe(false);
    await hoverForTooltip(user, target);
    expect(screen.getByRole('button', {description: '가사 지우기F2'})).toBe(
      target,
    );
  });

  it('closes at once when the pointer leaves', async () => {
    const user = setupTooltipUser();
    render(<ClearLyrics />);
    await hoverForTooltip(user, screen.getByRole('button', {name: '가사'}));
    await user.unhover(screen.getByRole('button', {name: '가사'}));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows the next tooltip at once when the pointer moves on', async () => {
    const user = setupTooltipUser();
    render(<ClearLyrics />);
    await hoverForTooltip(user, screen.getByRole('button', {name: '가사'}));
    await user.hover(screen.getByRole('button', {name: '모두'}));
    expect(screen.getByRole('tooltip').textContent).toBe(
      '모두 지우기F1본 화면, 무대 화면',
    );
  });

  it('closes on a click and on a key press', async () => {
    const user = setupTooltipUser();
    render(<ClearLyrics />);
    const target = screen.getByRole('button', {name: '가사'});
    await hoverForTooltip(user, target);
    await user.pointer({keys: '[MouseLeft]', target});
    expect(screen.queryByRole('tooltip')).toBeNull();

    await user.unhover(target);
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_GRACE_MS);
    });
    await hoverForTooltip(user, target);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('keeps the target own handlers', async () => {
    const user = setupTooltipUser();
    const onPointerEnter = vi.fn();
    render(
      <Tooltip text="내리기">
        <button type="button" onPointerEnter={onPointerEnter}>
          x
        </button>
      </Tooltip>,
    );
    await hoverForTooltip(user, screen.getByRole('button'));
    expect(onPointerEnter).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('tooltip')).toBeDefined();
  });
});

describe('ariaShortcut', () => {
  it('writes shortcuts the way aria-keyshortcuts reads them', () => {
    expect(ariaShortcut('Ctrl Z')).toBe('Control+Z');
    expect(ariaShortcut('Esc')).toBe('Escape');
    expect(ariaShortcut('F2')).toBe('F2');
  });
});

describe('withTooltipProps', () => {
  it('calls the own handler first and joins described-by ids', async () => {
    const calls: string[] = [];
    const merged = withTooltipProps<HTMLButtonElement>(
      {onBlur: () => calls.push('own'), 'aria-describedby': 'hint'},
      {
        onPointerEnter: () => undefined,
        onPointerLeave: () => undefined,
        onFocus: () => undefined,
        onBlur: () => calls.push('tooltip'),
        'aria-describedby': 'tip',
      },
    );
    render(
      <button type="button" {...merged}>
        x
      </button>,
    );
    const user = setupTooltipUser();
    await user.click(screen.getByRole('button'));
    await user.tab();
    expect(calls).toEqual(['own', 'tooltip']);
    expect(merged['aria-describedby']).toBe('hint tip');
  });
});

describe('TooltipController', () => {
  it('releases its window listeners once nothing shows or waits', () => {
    vi.useFakeTimers();
    const controller = new TooltipController();
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const target = document.createElement('button');
    controller.request({owner: 'a', target});
    controller.release('a');
    expect(add.mock.calls.length).toBeGreaterThan(0);
    expect(remove.mock.calls.length).toBe(add.mock.calls.length);
    expect(controller.current()).toBeNull();
    add.mockRestore();
    remove.mockRestore();
  });

  it('drops a pending tooltip when its owner leaves before the delay', () => {
    vi.useFakeTimers();
    const controller = new TooltipController();
    controller.request({owner: 'a', target: document.createElement('button')});
    controller.release('a');
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    expect(controller.current()).toBeNull();
  });
});
