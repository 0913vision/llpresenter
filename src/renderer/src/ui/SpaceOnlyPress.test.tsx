import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Checkbox} from './Checkbox';
import {Switch} from './Switch';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(resetTooltips);

describe.each(['checkbox', 'switch'] as const)(
  '%s keyboard activation',
  role => {
    it.each(['ctrlKey', 'altKey', 'metaKey', 'shiftKey'] as const)(
      'passes %s Enter without activating',
      modifier => {
        const change = vi.fn();
        render(
          role === 'checkbox' ? (
            <Checkbox aria-label="선택" checked={false} onChange={change} />
          ) : (
            <Switch aria-label="선택" checked={false} onChange={change} />
          ),
        );
        const button = screen.getByRole(role, {name: '선택'});
        const keys = vi.fn();
        window.addEventListener('keydown', keys);
        expect(
          fireEvent.keyDown(button, {key: 'Enter', [modifier]: true}),
        ).toBe(true);
        fireEvent.click(button, {detail: 0});
        fireEvent.keyUp(button, {key: 'Enter'});
        window.removeEventListener('keydown', keys);
        expect(keys).toHaveBeenCalledOnce();
        expect(change).not.toHaveBeenCalled();
      },
    );

    it.each(['ctrlKey', 'altKey', 'metaKey', 'shiftKey'] as const)(
      'passes %s Space without activating, even if the modifier is released first',
      modifier => {
        const change = vi.fn();
        render(
          role === 'checkbox' ? (
            <Checkbox aria-label="선택" checked={false} onChange={change} />
          ) : (
            <Switch aria-label="선택" checked={false} onChange={change} />
          ),
        );
        const button = screen.getByRole(role, {name: '선택'});
        const event = new KeyboardEvent('keydown', {
          key: ' ',
          code: 'Space',
          bubbles: true,
          cancelable: true,
          [modifier]: true,
        });
        fireEvent(button, event);
        expect(event.defaultPrevented).toBe(false);
        fireEvent.keyUp(button, {key: ' ', code: 'Space'});
        fireEvent.click(button, {detail: 0});
        expect(change).not.toHaveBeenCalled();
        fireEvent.click(button, {detail: 1, [modifier]: true});
        expect(change).toHaveBeenCalledExactlyOnceWith(true);
      },
    );

    it('still activates with unmodified Space', async () => {
      const change = vi.fn();
      render(
        role === 'checkbox' ? (
          <Checkbox aria-label="선택" checked={false} onChange={change} />
        ) : (
          <Switch aria-label="선택" checked={false} onChange={change} />
        ),
      );
      await userEvent.tab();
      await userEvent.keyboard(' ');
      expect(change).toHaveBeenCalledExactlyOnceWith(true);
    });

    it('does not leave a stale suppression after a canceled key or lost focus', async () => {
      const change = vi.fn();
      render(
        role === 'checkbox' ? (
          <Checkbox aria-label="선택" checked={false} onChange={change} />
        ) : (
          <Switch aria-label="선택" checked={false} onChange={change} />
        ),
      );
      const button = screen.getByRole(role, {name: '선택'});
      fireEvent.keyDown(button, {key: ' ', ctrlKey: true});
      fireEvent.keyUp(button, {key: ' '});
      await new Promise(resolve => setTimeout(resolve, 0));
      fireEvent.click(button, {detail: 0});
      expect(change).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(button, {key: ' ', ctrlKey: true});
      fireEvent.blur(button);
      fireEvent.click(button, {detail: 0});
      expect(change).toHaveBeenCalledTimes(2);
    });
    it('releases its tooltip on blur and forwards the blur handler', async () => {
      const onBlur = vi.fn();
      render(
        role === 'checkbox' ? (
          <Checkbox
            aria-label="선택"
            title="선택 설명"
            checked={false}
            onChange={() => {}}
            onBlur={onBlur}
          />
        ) : (
          <Switch
            aria-label="선택"
            title="선택 설명"
            checked={false}
            onChange={() => {}}
            onBlur={onBlur}
          />
        ),
      );
      const button = screen.getByRole(role, {name: '선택'});
      expect(await hoverForTooltip(button)).not.toBeNull();
      fireEvent.blur(button);
      expect(onBlur).toHaveBeenCalledOnce();
      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  },
);
