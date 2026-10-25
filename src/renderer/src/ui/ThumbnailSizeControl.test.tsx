import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {ThumbnailSizeControl} from './ThumbnailSizeControl';
import {DEFAULT_THUMBNAIL_SCALE_PERCENT} from './thumbnailSize';
import type {Workspace} from './workspace';

function Control({
  onChange = () => {},
  onCommit = () => {},
  workspace = 'prep',
  disabled = false,
}: {
  readonly onChange?: (value: number) => void;
  readonly onCommit?: (value: number) => void;
  readonly workspace?: Workspace;
  readonly disabled?: boolean;
}): JSX.Element {
  const [value, setValue] = useState(DEFAULT_THUMBNAIL_SCALE_PERCENT);
  return (
    <>
      <button type="button">앞</button>
      <ThumbnailSizeControl
        value={value}
        onChange={next => {
          setValue(next);
          onChange(next);
        }}
        onCommit={onCommit}
        workspace={workspace}
        disabled={disabled}
      />
      <button type="button">뒤</button>
    </>
  );
}

function input(role: 'slider' | 'spinbutton'): HTMLInputElement {
  const element = screen.getByRole(role);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error('Missing size input');
  }
  return element;
}

describe('ThumbnailSizeControl', () => {
  it('uses the spec-13 default, range, and continuous pointer step', () => {
    render(<Control />);
    expect(input('slider').value).toBe('100');
    expect(input('slider').min).toBe('50');
    expect(input('slider').max).toBe('200');
    expect(input('slider').step).toBe('any');
    expect(input('spinbutton').value).toBe('100%');
  });

  it('previews fractions, mirrors the rounded field, then commits a whole percent', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<Control onChange={onChange} onCommit={onCommit} />);
    Object.defineProperty(input('slider'), 'setPointerCapture', {
      value: vi.fn(),
    });
    fireEvent.pointerDown(input('slider'));
    fireEvent.change(input('slider'), {target: {value: '123.45'}});
    expect(onChange).toHaveBeenLastCalledWith(123.45);
    expect(input('spinbutton').value).toBe('123%');
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(input('slider'));
    expect(onChange).toHaveBeenLastCalledWith(123);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(123);
    expect(input('slider').value).toBe('123');
  });

  it('buffers typing, rounds on Enter, and does not commit twice on blur', async () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<Control onChange={onChange} onCommit={onCommit} />);
    await userEvent.clear(input('spinbutton'));
    await userEvent.type(input('spinbutton'), '123.6%');
    expect(onChange).not.toHaveBeenCalled();
    expect(input('slider').value).toBe('100');
    await userEvent.keyboard('{Enter}');
    expect(input('slider').value).toBe('124');
    expect(input('spinbutton').value).toBe('124%');
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(124);
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('clamps typed values on blur and follows the committed value in the slider', async () => {
    const onCommit = vi.fn();
    render(<Control onCommit={onCommit} />);
    await userEvent.clear(input('spinbutton'));
    await userEvent.type(input('spinbutton'), '250');
    await userEvent.tab();
    expect(input('slider').value).toBe('200');
    expect(input('spinbutton').value).toBe('200%');
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(200);
  });

  it('cancels the typed change with Escape', async () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<Control onChange={onChange} onCommit={onCommit} />);
    await userEvent.clear(input('spinbutton'));
    await userEvent.type(input('spinbutton'), '150');
    await userEvent.keyboard('{Escape}');
    expect(input('spinbutton').value).toBe('100%');
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('ignores invalid text and IME confirmation until composition finishes', async () => {
    const onCommit = vi.fn();
    render(<Control onCommit={onCommit} />);
    await userEvent.clear(input('spinbutton'));
    await userEvent.type(input('spinbutton'), '150');
    fireEvent.keyDown(input('spinbutton'), {key: 'Enter', isComposing: true});
    expect(onCommit).not.toHaveBeenCalled();
    await userEvent.clear(input('spinbutton'));
    await userEvent.type(input('spinbutton'), 'x{Enter}');
    expect(input('spinbutton').value).toBe('100%');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('steps by 1 or 10 with Shift and clamps the slider at its ends', async () => {
    const onCommit = vi.fn();
    render(<Control onCommit={onCommit} />);
    input('slider').focus();
    await userEvent.keyboard(
      '{ArrowRight}{Shift>}{ArrowRight}{/Shift}{End}{ArrowRight}{Home}{ArrowLeft}',
    );
    expect(onCommit.mock.calls).toEqual([[101], [111], [200], [50]]);
    expect(input('spinbutton').value).toBe('50%');
  });

  it('steps and commits from the percentage field', async () => {
    const onCommit = vi.fn();
    render(<Control onCommit={onCommit} />);
    input('spinbutton').focus();
    await userEvent.keyboard('{ArrowUp}{Shift>}{ArrowDown}{/Shift}');
    expect(input('slider').value).toBe('91');
    expect(onCommit.mock.calls).toEqual([[101], [91]]);
  });

  it('restores Show focus after dragging but lets its percentage field take focus', async () => {
    render(<Control workspace="show" />);
    const before = screen.getByRole('button', {name: '앞'});
    before.focus();
    const capture = vi.fn();
    Object.defineProperty(input('slider'), 'setPointerCapture', {
      value: capture,
    });
    fireEvent.pointerDown(input('slider'));
    expect(capture).toHaveBeenCalledTimes(1);
    input('slider').focus();
    fireEvent.change(input('slider'), {target: {value: '110.2'}});
    fireEvent.pointerUp(input('slider'));
    expect(document.activeElement).toBe(before);
    await userEvent.click(input('spinbutton'));
    expect(document.activeElement).toBe(input('spinbutton'));
  });

  it('keeps Prep focus on the slider and finishes cancelled pointer interactions', () => {
    const onCommit = vi.fn();
    render(<Control onCommit={onCommit} />);
    Object.defineProperty(input('slider'), 'setPointerCapture', {
      value: vi.fn(),
    });
    fireEvent.pointerDown(input('slider'));
    input('slider').focus();
    fireEvent.change(input('slider'), {target: {value: '110.8'}});
    fireEvent.pointerCancel(input('slider'));
    expect(document.activeElement).toBe(input('slider'));
    expect(input('slider').value).toBe('111');
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(111);
  });

  it('disables both inputs without reporting changes or commits', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<Control onChange={onChange} onCommit={onCommit} disabled />);
    expect(input('slider').disabled).toBe(true);
    expect(input('spinbutton').disabled).toBe(true);
    fireEvent.keyDown(input('slider'), {key: 'ArrowRight'});
    fireEvent.pointerUp(input('slider'));
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
