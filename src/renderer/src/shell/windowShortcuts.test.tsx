import {act, cleanup, fireEvent, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {setColumnDragActive} from '@renderer/state/drag';
import {modalStack} from '@renderer/ui/modalStack';
import {useWindowShortcuts} from './windowShortcuts';

function press(
  options: KeyboardEventInit = {},
  target: Element = document.body,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code: 'KeyE',
    key: 'ㄷ',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  setColumnDragActive(false);
});

describe('window shortcuts', () => {
  it('matches physical modifiers exactly and swallows held repeats without rerunning', () => {
    const run = vi.fn();
    renderHook(() => useWindowShortcuts([{code: 'KeyE', ctrl: true, run}]));
    expect(press().defaultPrevented).toBe(true);
    expect(press({repeat: true}).defaultPrevented).toBe(true);
    for (const modifiers of [
      {altKey: true},
      {shiftKey: true},
      {metaKey: true},
      {ctrlKey: false},
    ]) {
      expect(press(modifiers).defaultPrevented).toBe(false);
    }
    expect(run).toHaveBeenCalledOnce();
  });

  it('passes commands to a composing field, including key events without the composition flag', () => {
    const run = vi.fn();
    renderHook(() => useWindowShortcuts([{code: 'KeyE', ctrl: true, run}]));
    press({isComposing: true});
    fireEvent.compositionStart(document.body);
    press();
    expect(run).not.toHaveBeenCalled();
    fireEvent.compositionEnd(document.body);
    press();
    expect(run).toHaveBeenCalledOnce();
  });

  it('leaves a recorder, open menu, modal, and drag in control', () => {
    const run = vi.fn();
    renderHook(() => useWindowShortcuts([{code: 'KeyE', ctrl: true, run}]));
    const recorder = document.createElement('input');
    recorder.setAttribute('data-shortcut-recording', '');
    document.body.append(recorder);
    press({}, recorder);
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.append(menu);
    press();
    menu.remove();
    const modal = document.createElement('div');
    document.body.append(modal);
    const close = modalStack.push(modal);
    press();
    close();
    setColumnDragActive(true);
    press();
    setColumnDragActive(false);
    fireEvent.dragStart(document.body);
    press();
    fireEvent.dragEnd(document.body);
    expect(run).not.toHaveBeenCalled();
    press();
    expect(run).toHaveBeenCalledOnce();
  });

  it('uses current callbacks and releases listeners after unmount', () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = renderHook(
      ({run}) => useWindowShortcuts([{code: 'KeyE', ctrl: true, run}]),
      {initialProps: {run: first}},
    );
    view.rerender({run: second});
    press();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    view.unmount();
    expect(press().defaultPrevented).toBe(false);
    expect(second).toHaveBeenCalledOnce();
  });
});
