import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useRef, type JSX} from 'react';
import {modalStack} from '@renderer/ui/modalStack';
import {
  useCloseKeys,
  useInitialListFocus,
} from '@renderer/app/useWindowKeyboard';

afterEach(cleanup);

function Closing({
  close,
  recording = false,
}: {
  readonly close: () => void;
  readonly recording?: boolean;
}): JSX.Element {
  useCloseKeys(close);
  return (
    <input
      aria-label="field"
      {...(recording ? {'data-shortcut-recording': ''} : {})}
    />
  );
}

function Listed({
  late = false,
  requestId,
}: {
  readonly late?: boolean;
  readonly requestId?: number;
}): JSX.Element {
  const root = useRef<HTMLElement>(null);
  useInitialListFocus(root, requestId);
  return (
    <main ref={root}>
      <button type="button">before</button>
      {late ? null : (
        <div role="listbox" aria-label="items">
          <div role="option" aria-selected={false} tabIndex={-1}>
            first
          </div>
          <div role="option" aria-selected tabIndex={0}>
            second
          </div>
        </div>
      )}
    </main>
  );
}

describe('secondary window keyboard', () => {
  it('does not close while a modal without onEscape is open', () => {
    const close = vi.fn();
    render(<Closing close={close} />);
    const modal = document.createElement('div');
    document.body.append(modal);
    const release = modalStack.push(modal);
    const field = screen.getByLabelText('field');
    fireEvent.keyDown(field, {key: 'Escape'});
    fireEvent.keyDown(field, {key: 'w', ctrlKey: true});
    expect(close).not.toHaveBeenCalled();
    release();
    modal.remove();
    fireEvent.keyDown(field, {key: 'Escape'});
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes on Esc and Ctrl W from a field', () => {
    const close = vi.fn();
    render(<Closing close={close} />);
    const field = screen.getByLabelText('field');
    fireEvent.keyDown(field, {key: 'Escape'});
    expect(close).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(field, {key: 'w', ctrlKey: true});
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('leaves a key that a control already used, a recording field, and other keys', () => {
    const close = vi.fn();
    const view = render(<Closing close={close} />);
    const field = screen.getByLabelText('field');
    field.addEventListener('keydown', event => event.preventDefault());
    fireEvent.keyDown(field, {key: 'Escape'});
    expect(close).not.toHaveBeenCalled();
    view.rerender(<Closing close={close} recording />);
    const recorder = screen.getByLabelText('field');
    fireEvent.keyDown(recorder, {key: 'Escape'});
    fireEvent.keyDown(recorder, {key: 'w', ctrlKey: true});
    view.rerender(<Closing close={close} />);
    const plain = screen.getByLabelText('field');
    fireEvent.keyDown(plain, {key: 'w'});
    fireEvent.keyDown(plain, {key: 'Escape', ctrlKey: true});
    fireEvent.keyDown(plain, {key: 'Escape', isComposing: true});
    expect(close).not.toHaveBeenCalled();
  });

  it('focuses the selected list entry when the window opens', () => {
    render(<Listed />);
    expect(document.activeElement?.textContent).toBe('second');
  });

  it('focuses the selected entry again when a mounted window receives a new request', () => {
    const view = render(<Listed requestId={1} />);
    const selected = screen.getByRole('option', {name: 'second'});
    expect(document.activeElement).toBe(selected);
    selected.blur();

    view.rerender(<Listed requestId={2} />);
    expect(document.activeElement).toBe(selected);

    const control = screen.getByRole('button', {name: 'before'});
    control.focus();
    view.rerender(<Listed requestId={3} />);
    expect(document.activeElement).toBe(control);
  });

  it('keeps a cancelled late-focus request cancelled until the window opens again', async () => {
    const view = render(<Listed late requestId={1} />);
    fireEvent.keyDown(document.body, {key: 'Tab'});
    view.rerender(<Listed requestId={1} />);
    await Promise.resolve();
    expect(document.activeElement).toBe(document.body);

    view.rerender(<Listed requestId={2} />);
    expect(document.activeElement?.textContent).toBe('second');
  });

  it('uses the current list Tab stop while selection attributes are still updating', () => {
    const view = render(<Listed requestId={1} />);
    const previous = screen.getByRole('option', {name: 'second'});
    const next = screen.getByRole('option', {name: 'first'});
    previous.blur();
    previous.tabIndex = -1;
    next.tabIndex = 0;

    view.rerender(<Listed requestId={2} />);

    expect(document.activeElement).toBe(next);
  });

  it('stops waiting for the list after the first key press', async () => {
    const view = render(<Listed late />);
    fireEvent.keyDown(document.body, {key: 'a'});
    view.rerender(<Listed />);
    await Promise.resolve();
    expect(document.activeElement).toBe(document.body);
  });

  it('waits for a late list and leaves focus alone once it moved', async () => {
    const view = render(<Listed late />);
    expect(document.activeElement).toBe(document.body);
    screen.getByText('before').focus();
    view.rerender(<Listed />);
    await Promise.resolve();
    expect(document.activeElement?.textContent).toBe('before');
  });
});
