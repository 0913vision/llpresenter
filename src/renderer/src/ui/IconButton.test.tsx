import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {IconButton} from './IconButton';

describe('IconButton', () => {
  it('is named by its label and shows the shortcut in the tooltip', () => {
    render(<IconButton icon="x" label="닫기" size="md" shortcut="Esc" />);
    const button = screen.getByRole('button', {name: '닫기'});
    expect(button.getAttribute('title')).toBe('닫기 Esc');
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    expect(button.hasAttribute('aria-haspopup')).toBe(false);
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
    expect(button.getAttribute('title')).toBe('소리가 꺼져 있습니다');
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(onPressedChange).not.toHaveBeenCalled();
  });
});
