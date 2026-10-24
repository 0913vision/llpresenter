import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {IconButton} from './IconButton';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(resetTooltips);

describe('IconButton', () => {
  it('is named by its label and shows the shortcut in the tooltip', async () => {
    render(<IconButton icon="x" label="닫기" size="md" shortcut="Esc" />);
    const button = screen.getByRole('button', {name: '닫기'});
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    expect(button.hasAttribute('aria-haspopup')).toBe(false);
    expect(button.getAttribute('aria-keyshortcuts')).toBe('Escape');
    const tooltip = await hoverForTooltip(button);
    expect(tooltip?.textContent).toBe('닫기Esc');
  });

  it('reports the opposite value on each press of an on/off button', async () => {
    const onPressedChange = vi.fn();
    const {rerender} = render(
      <IconButton
        icon="loop"
        label="반복"
        pressed={false}
        onPressedChange={onPressedChange}
      />,
    );
    const button = screen.getByRole('button', {name: '반복'});
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(button);
    expect(onPressedChange).toHaveBeenLastCalledWith(true);

    rerender(
      <IconButton
        icon="loop"
        label="반복"
        pressed
        onPressedChange={onPressedChange}
      />,
    );
    expect(button.getAttribute('aria-pressed')).toBe('true');
    await userEvent.keyboard(' ');
    expect(onPressedChange).toHaveBeenLastCalledWith(false);
  });

  it('marks a menu button and whether its menu is open', () => {
    render(<IconButton icon="more" label="메뉴" menu expanded />);
    const button = screen.getByRole('button', {name: '메뉴'});
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('stays focusable but ignores presses while disabled', async () => {
    const onClick = vi.fn();
    const onPressedChange = vi.fn();
    render(
      <IconButton
        icon="loop"
        label="반복"
        pressed={false}
        disabled
        title="소리가 꺼져 있습니다"
        onClick={onClick}
        onPressedChange={onPressedChange}
      />,
    );
    const button = screen.getByRole('button', {name: '반복'});
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(onPressedChange).not.toHaveBeenCalled();
    await userEvent.unhover(button);
    const tooltip = await hoverForTooltip(button);
    expect(tooltip?.textContent).toBe('소리가 꺼져 있습니다');
  });
});

describe('IconButton at the end of a row', () => {
  it.each([false, true])(
    'keeps clicks, Enter, and Space from the row (disabled: %s)',
    async disabled => {
      const onRowClick = vi.fn();
      const onRowKey = vi.fn();
      render(
        <div
          role="option"
          aria-selected="false"
          tabIndex={-1}
          onClick={onRowClick}
          onKeyDown={event => {
            onRowKey(event.key);
          }}
        >
          만복의 근원 하나님
          <IconButton icon="x" label="내리기" disabled={disabled} />
        </div>,
      );
      const button = screen.getByRole('button', {name: '내리기'});
      await userEvent.click(button);
      await userEvent.keyboard('{Enter}');
      await userEvent.keyboard(' ');
      expect(onRowClick).not.toHaveBeenCalled();
      expect(onRowKey).not.toHaveBeenCalledWith('Enter');
      expect(onRowKey).not.toHaveBeenCalledWith(' ');
    },
  );

  it('lets Enter and Space with a modifier reach the row', async () => {
    const onRowKey = vi.fn();
    render(
      <div
        role="option"
        aria-selected="false"
        tabIndex={-1}
        onKeyDown={event => {
          onRowKey(event.key);
        }}
      >
        만복의 근원 하나님
        <IconButton icon="x" label="내리기" />
      </div>,
    );
    screen.getByRole('button', {name: '내리기'}).focus();
    await userEvent.keyboard('{Shift>}{Enter} {/Shift}');
    expect(onRowKey.mock.calls).toEqual([['Shift'], ['Enter'], [' ']]);
  });
});
