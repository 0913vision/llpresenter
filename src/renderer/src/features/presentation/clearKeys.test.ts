import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as clearState from '@renderer/session/clear';
import {handleClearKey, useClearKeys} from './clearKeys';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {emptyLiveState} from '@core/live/state';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {useLive} from '@renderer/session/live';

it('dispatches an assigned Item Off and Restore key with no default binding', () => {
  const send = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  useLive.setState({
    state: {
      ...emptyLiveState(),
      themeItem: {id: 'item', kind: 'song', source: 'service'},
    },
  });
  appendTo('section', {'data-workspace-layout': 'show'});
  const {unmount} = renderHook(() => useClearKeys());
  const pressItemOff = (target: Element): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', {
      code: 'F8',
      key: 'F8',
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  };
  expect(pressItemOff(document.body).defaultPrevented).toBe(false);
  act(() => commandBindingStore.set({'item.stop': [{code: 'F8', mods: []}]}));
  try {
    expect(pressItemOff(document.body).defaultPrevented).toBe(true);
    expect(send).toHaveBeenCalledExactlyOnceWith({type: 'item.stop'});
    act(() =>
      useLive.setState({
        state: {...emptyLiveState(), themeItem: null, canRestoreItem: true},
      }),
    );
    expect(pressItemOff(document.body).defaultPrevented).toBe(true);
    expect(send).toHaveBeenLastCalledWith({type: 'item.restore'});
  } finally {
    unmount();
    commandBindingStore.set({});
    useLive.setState({state: null});
    delete window.llp;
  }
});

it.each([
  ['input', 'input', {}],
  ['textarea', 'textarea', {}],
  ['editable text', 'div', {contenteditable: 'true', tabindex: '0'}],
  ['menu', 'div', {role: 'menu', tabindex: '0'}],
  ['dialog', 'div', {role: 'dialog', tabindex: '0'}],
  ['alert dialog', 'div', {role: 'alertdialog', tabindex: '0'}],
] as const)(
  'leaves assigned Item Off to a focused %s and resumes it in Show',
  (_name, tag, attributes) => {
    const send = vi.fn();
    window.llp = mockLlpApi({live: {send}});
    useLive.setState({
      state: {
        ...emptyLiveState(),
        themeItem: {id: 'item', kind: 'song', source: 'service'},
      },
    });
    commandBindingStore.set({'item.stop': [{code: 'F8', mods: []}]});
    appendTo('section', {'data-workspace-layout': 'show'});
    const {unmount} = renderHook(() => useClearKeys());
    const owner = appendTo(tag, attributes);
    owner.focus();
    try {
      expect(document.activeElement).toBe(owner);
      const event = new KeyboardEvent('keydown', {
        code: 'F8',
        key: 'F8',
        bubbles: true,
        cancelable: true,
      });
      owner.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(send).not.toHaveBeenCalled();
      if (owner.getAttribute('role')) {
        document.body.dispatchEvent(
          new KeyboardEvent('keydown', {code: 'F8', key: 'F8', bubbles: true}),
        );
        expect(send).not.toHaveBeenCalled();
      }
      owner.remove();
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'F8',
          key: 'F8',
          bubbles: true,
          cancelable: true,
        }),
      );
      expect(send).toHaveBeenCalledExactlyOnceWith({type: 'item.stop'});
    } finally {
      unmount();
      commandBindingStore.set({});
      useLive.setState({state: null});
      delete window.llp;
    }
  },
);

function press(
  code: string,
  options: KeyboardEventInit = {},
  target: Element = document.body,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code,
    key: 'Unidentified',
    bubbles: true,
    cancelable: true,
    ...options,
  });
  Object.defineProperty(event, 'target', {value: target});
  handleClearKey(event);
  return event;
}

function appendTo(tag: string, attributes: Record<string, string> = {}) {
  const element = document.body.appendChild(document.createElement(tag));
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

beforeEach(() => {
  vi.spyOn(clearState, 'clearLayer').mockImplementation(() => undefined);
  vi.spyOn(clearState, 'undoClear').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('handleClearKey F1 to F7', () => {
  it.each([
    ['F1', 'all'],
    ['F2', 'slide'],
    ['F3', 'media'],
    ['F4', 'prop'],
    ['F5', 'audio'],
    ['F6', 'message'],
    ['F7', 'notice'],
  ])('clears with %s the layer %s and swallows the key', (code, target) => {
    expect(press(code).defaultPrevented).toBe(true);
    expect(clearState.clearLayer).toHaveBeenCalledWith(target);
  });

  it('clear in a text field and during an IME composition', () => {
    press('F2', {}, appendTo('input'));
    press('F3', {isComposing: true}, appendTo('textarea'));
    expect(clearState.clearLayer).toHaveBeenCalledTimes(2);
  });

  it('leave a field that records a shortcut alone', () => {
    const recorder = appendTo('div', {'data-shortcut-recording': ''});
    const inner = recorder.appendChild(document.createElement('button'));
    const event = press('F2', {}, inner);
    expect(clearState.clearLayer).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('run once for a held key and swallow the repeats', () => {
    press('F2');
    const repeated = press('F2', {repeat: true});
    expect(clearState.clearLayer).toHaveBeenCalledTimes(1);
    expect(repeated.defaultPrevented).toBe(true);
  });

  it('are ignored with a modifier and for other keys', () => {
    press('F2', {ctrlKey: true});
    press('F2', {shiftKey: true});
    press('F8');
    press('KeyA');
    expect(clearState.clearLayer).not.toHaveBeenCalled();
  });

  it('are ignored for an event that is already handled', () => {
    const event = new KeyboardEvent('keydown', {code: 'F2', cancelable: true});
    event.preventDefault();
    handleClearKey(event);
    expect(clearState.clearLayer).not.toHaveBeenCalled();
  });
});

describe('handleClearKey Ctrl Z', () => {
  it('does not undo a clear and leaves the key to others', () => {
    const event = press('KeyZ', {ctrlKey: true});
    expect(clearState.undoClear).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('useClearKeys', () => {
  function pressOn(
    target: Element,
    code: string,
    options: KeyboardEventInit = {},
  ): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      code,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    target.dispatchEvent(event);
    return event;
  }

  it('clears with F2 even when a handler below it consumes the key', () => {
    renderHook(() => useClearKeys());
    const field = appendTo('input');
    field.addEventListener('keydown', event => {
      event.preventDefault();
      event.stopPropagation();
    });
    pressOn(field, 'F2');
    expect(clearState.clearLayer).toHaveBeenCalledWith('slide');
  });

  it('stops listening when it unmounts', () => {
    const {unmount} = renderHook(() => useClearKeys());
    unmount();
    pressOn(document.body, 'F2');
    expect(clearState.clearLayer).not.toHaveBeenCalled();
  });
});
