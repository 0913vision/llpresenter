import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {installMockClock} from '../../../../test/mock-clock';
import {Button} from './Button';
import {IconButton} from './IconButton';
import {Tooltip, ariaShortcut, withTooltipProps} from './Tooltip';
import {
  TOOLTIP_DELAY_MS,
  TOOLTIP_GRACE_MS,
  TooltipController,
} from './tooltipController';
import {
  hoverForTooltip,
  letTimePass,
  pointAt,
  pointAway,
  resetTooltips,
} from './tooltipTesting';

afterEach(resetTooltips);

function ClearLyrics(): JSX.Element {
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

function button(name: string): HTMLElement {
  return screen.getByRole('button', {name});
}

describe('Tooltip', () => {
  it('shows after the pointer rests for 600ms, not before', async () => {
    const clock = installMockClock();
    render(<ClearLyrics />);
    pointAt(button('가사'));
    await letTimePass(clock, TOOLTIP_DELAY_MS - 1);
    expect(screen.queryByRole('tooltip')).toBeNull();
    await letTimePass(clock, 1);
    expect(screen.getByRole('tooltip').textContent).toBe('가사 지우기F2');
  });

  it('describes its target and gives the shortcut in aria form', async () => {
    render(<ClearLyrics />);
    const target = button('가사');
    expect(target.getAttribute('aria-keyshortcuts')).toBe('F2');
    expect(target.hasAttribute('aria-describedby')).toBe(false);
    await hoverForTooltip(target);
    expect(screen.getByRole('button', {description: '가사 지우기F2'})).toBe(
      target,
    );
  });

  it('gives its shortcut to a Button, which draws its own tooltip too', () => {
    render(
      <>
        <Tooltip text="가사 지우기" shortcut="F2">
          <Button>가사</Button>
        </Tooltip>
        <Tooltip text="되돌리기" shortcut="Ctrl Z">
          <IconButton icon="undo" label="되돌림" />
        </Tooltip>
      </>,
    );
    expect(button('가사').getAttribute('aria-keyshortcuts')).toBe('F2');
    expect(button('되돌림').getAttribute('aria-keyshortcuts')).toBe(
      'Control+Z',
    );
  });

  it('closes at once when the pointer leaves', async () => {
    render(<ClearLyrics />);
    await hoverForTooltip(button('가사'));
    pointAway(button('가사'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows the next tooltip at once while one shows or just closed', async () => {
    render(<ClearLyrics />);
    await hoverForTooltip(button('가사'));
    pointAway(button('가사'));
    pointAt(button('모두'));
    expect(screen.getByRole('tooltip').textContent).toBe(
      '모두 지우기F1본 화면, 무대 화면',
    );
  });

  it('waits the full delay again once the grace period is over', async () => {
    const clock = installMockClock();
    render(<ClearLyrics />);
    await hoverForTooltip(button('가사'));
    pointAway(button('가사'));
    await letTimePass(clock, TOOLTIP_GRACE_MS);
    pointAt(button('모두'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    await letTimePass(clock, TOOLTIP_DELAY_MS);
    expect(screen.getByRole('tooltip')).toBeDefined();
  });

  it('closes on a click and on a key press', async () => {
    render(<ClearLyrics />);
    const target = button('가사');
    await hoverForTooltip(target);
    fireEvent.pointerDown(target);
    expect(screen.queryByRole('tooltip')).toBeNull();

    pointAway(target);
    await hoverForTooltip(target);
    fireEvent.keyDown(target, {key: 'Escape'});
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('keeps the target own handlers', async () => {
    const onPointerEnter = vi.fn();
    render(
      <Tooltip text="내리기">
        <button type="button" onPointerEnter={onPointerEnter}>
          x
        </button>
      </Tooltip>,
    );
    await hoverForTooltip(screen.getByRole('button'));
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
    await userEvent.click(screen.getByRole('button'));
    await userEvent.tab();
    expect(calls).toEqual(['own', 'tooltip']);
    expect(merged['aria-describedby']).toBe('hint tip');
  });
});

describe('TooltipController', () => {
  it('releases its window listeners once nothing shows or waits', () => {
    installMockClock();
    const controller = new TooltipController();
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    controller.request({owner: 'a', target: document.createElement('button')});
    controller.release('a');
    expect(add.mock.calls.length).toBeGreaterThan(0);
    expect(remove.mock.calls.length).toBe(add.mock.calls.length);
    expect(controller.current()).toBeNull();
    add.mockRestore();
    remove.mockRestore();
  });

  it('drops a pending tooltip when its owner leaves before the delay', async () => {
    const clock = installMockClock();
    const controller = new TooltipController();
    controller.request({owner: 'a', target: document.createElement('button')});
    controller.release('a');
    await clock.advance(TOOLTIP_DELAY_MS);
    expect(controller.current()).toBeNull();
  });

  it('ignores a grace period that lies in the future after a clock change', async () => {
    const clock = installMockClock(new Date('2026-03-01T09:00:00.000Z'));
    const controller = new TooltipController();
    const target = document.createElement('button');
    controller.request({owner: 'a', target});
    await clock.advance(TOOLTIP_DELAY_MS);
    controller.hide();
    installMockClock(new Date('2026-02-01T09:00:00.000Z'));
    controller.request({owner: 'b', target});
    expect(controller.current()).toBeNull();
  });
});
