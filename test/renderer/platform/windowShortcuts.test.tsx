import {act, cleanup, fireEvent, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {setColumnDragActive} from '@renderer/platform/drag';
import {modalStack} from '@renderer/ui/modalStack';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {commandBindingStore} from '@renderer/ui/commandBindings';

function press(
  options: KeyboardEventInit = {},
  target: Element = document.body,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code: 'KeyR',
    key: 'ㄱ',
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
  commandBindingStore.set({});
});

describe('window shortcuts', () => {
  it.each(['listbox', 'button', 'text', 'recording', 'menu', 'dialog'])(
    'respects %s focus for remapped navigation and clear commands',
    focus => {
      const next = vi.fn();
      const clear = vi.fn();
      commandBindingStore.set({
        'show.next': [{code: 'F9', mods: []}],
        'clear.slide': [{code: 'F8', mods: []}],
      });
      renderHook(() =>
        useWindowShortcuts([
          {id: 'show.next', run: next},
          {id: 'clear.slide', run: clear},
        ]),
      );
      const target = document.createElement(
        focus === 'text' || focus === 'recording'
          ? 'input'
          : focus === 'button'
            ? 'button'
            : 'div',
      );
      if (['listbox', 'menu', 'dialog'].includes(focus)) {
        target.setAttribute('role', focus);
      }
      if (focus === 'recording') {
        target.setAttribute('data-shortcut-recording', '');
      }
      target.tabIndex = 0;
      document.body.append(target);
      target.focus();
      expect(document.activeElement).toBe(target);
      press({code: 'F9', key: 'F9', ctrlKey: false}, target);
      press({code: 'F8', key: 'F8', ctrlKey: false}, target);
      expect(next).toHaveBeenCalledTimes(
        focus === 'listbox' || focus === 'button' ? 1 : 0,
      );
      expect(clear).toHaveBeenCalledTimes(focus === 'recording' ? 0 : 1);
    },
  );

  it.each([
    'pointerup',
    'pointercancel',
    'lostpointercapture',
    'blur',
    'escape',
  ])('releases pointer drag precedence after %s', ending => {
    const run = vi.fn();
    renderHook(() => useWindowShortcuts([{id: 'workspace.prep', run}]));
    fireEvent.pointerDown(document.body, {
      pointerId: 1,
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(window, {pointerId: 1, clientX: 10, clientY: 0});
    press();
    expect(run).not.toHaveBeenCalled();
    if (ending === 'escape') press({code: 'Escape', ctrlKey: false});
    else fireEvent(window, new Event(ending));
    press();
    expect(run).toHaveBeenCalledOnce();
  });

  it('matches physical modifiers exactly and swallows held repeats without rerunning', () => {
    const run = vi.fn();
    renderHook(() => useWindowShortcuts([{id: 'workspace.prep', run}]));
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
    renderHook(() => useWindowShortcuts([{id: 'workspace.prep', run}]));
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
    renderHook(() => useWindowShortcuts([{id: 'workspace.prep', run}]));
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
      ({run}) => useWindowShortcuts([{id: 'workspace.prep', run}]),
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
