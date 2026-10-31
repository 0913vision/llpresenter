import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {setColumnDragActive} from '@renderer/platform/drag';
import {modalStack} from '@renderer/ui/modalStack';
import {useWindowShortcuts} from './windowShortcuts';
import {workspaceShortcuts} from '../app/shell/workspaceCommands';
import {useQuickDrag} from '@renderer/features/quick/useQuickDrag';

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
  it('blocks workspace keys during actual quick-list pointer reordering and releases them on drop', () => {
    const onWorkspace = vi.fn();
    function QuickList() {
      const drag = useQuickDrag({enabled: true, revision: 1, onMove: vi.fn()});
      useWindowShortcuts(
        workspaceShortcuts({onWorkspace, onMedia: vi.fn(), imported: false}),
      );
      return (
        <div {...drag.listProps}>
          <div data-quick-id="first">
            <button>First quick item</button>
          </div>
          <div data-quick-id="second">
            <button>Second quick item</button>
          </div>
        </div>
      );
    }
    render(<QuickList />);
    const first = screen.getByRole('button', {name: 'First quick item'});
    const pointer = {pointerId: 1, button: 0, clientX: 10, clientY: 10};
    fireEvent.pointerDown(first, pointer);
    fireEvent.pointerMove(window, {...pointer, clientY: 30});
    expect(press().defaultPrevented).toBe(false);
    expect(press({code: 'KeyR'}).defaultPrevented).toBe(false);
    expect(onWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'First quick item'})).toBe(first);
    fireEvent.pointerUp(window, {...pointer, clientY: 30});
    press();
    expect(onWorkspace).toHaveBeenCalledExactlyOnceWith('prep');
  });

  it.each(['pointercancel', 'lostpointercapture', 'blur', 'escape'])(
    'releases pointer drag precedence after %s',
    ending => {
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
    },
  );

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
