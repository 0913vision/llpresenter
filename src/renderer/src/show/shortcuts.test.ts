import {renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {setColumnDragActive} from '@renderer/state/drag';
import {seedSampleService} from './testing/sampleService';
import * as showState from '@renderer/state/show';
import {
  handleShowFocusIn,
  handleShowKey,
  handleShowKeyUp,
  handleShowMouseDown,
  useShowKeys,
} from './shortcuts';

function keyEvent(params: {
  readonly type: 'keydown' | 'keyup';
  readonly code: string;
  readonly options?: KeyboardEventInit;
  readonly target?: Element;
}): KeyboardEvent {
  const {type, code, options = {}, target = document.body} = params;
  const event = new KeyboardEvent(type, {
    code,
    key: 'Unidentified',
    bubbles: true,
    cancelable: true,
    ...options,
  });
  Object.defineProperty(event, 'target', {value: target});
  return event;
}

function press(
  code: string,
  options: KeyboardEventInit = {},
  target: Element = document.body,
): KeyboardEvent {
  const event = keyEvent({type: 'keydown', code, options, target});
  handleShowKey(event);
  return event;
}

function release(code: string, target: Element = document.body): KeyboardEvent {
  const event = keyEvent({type: 'keyup', code, target});
  handleShowKeyUp(event);
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
  seedSampleService();
  vi.spyOn(showState, 'outputNext').mockImplementation(() => undefined);
  vi.spyOn(showState, 'outputPrevious').mockImplementation(() => undefined);
  vi.spyOn(showState, 'outputLabel').mockImplementation(() => undefined);
  vi.spyOn(showState, 'openNextItem').mockImplementation(() => undefined);
  vi.spyOn(showState, 'openPreviousItem').mockImplementation(() => undefined);
  vi.spyOn(showState, 'revealLiveItem').mockImplementation(() => undefined);
});

afterEach(() => {
  setColumnDragActive(false);
  release('Space');
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('handleShowKey next and previous', () => {
  it.each(['ArrowRight', 'Space', 'PageDown'])(
    'outputs the next 장 with %s',
    code => {
      expect(press(code).defaultPrevented).toBe(true);
      expect(showState.outputNext).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['ArrowLeft', 'PageUp'])('outputs the previous 장 with %s', code => {
    expect(press(code).defaultPrevented).toBe(true);
    expect(showState.outputPrevious).toHaveBeenCalledTimes(1);
  });

  it('matches the physical key and not the character', () => {
    press('ArrowRight', {key: 'ㅊ'});
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
    press('KeyA', {key: 'ArrowRight'});
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    press('ArrowUp');
    press('ArrowDown');
    press('Enter');
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(showState.outputPrevious).not.toHaveBeenCalled();
  });

  it('ignores keys with a modifier', () => {
    press('ArrowRight', {ctrlKey: true});
    press('ArrowRight', {shiftKey: true});
    press('PageDown', {altKey: true});
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it('runs a held key once and still swallows the repeats', () => {
    press('PageDown');
    const repeated = press('PageDown', {repeat: true});
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
    expect(repeated.defaultPrevented).toBe(true);
  });

  it('ignores an event that is already handled', () => {
    const event = keyEvent({type: 'keydown', code: 'ArrowRight'});
    event.preventDefault();
    handleShowKey(event);
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it('works with the 장 grid and the 예배 순서 list in focus', () => {
    const grid = appendTo('div', {'data-slide-grid': ''});
    const tile = grid.appendChild(document.createElement('button'));
    const list = appendTo('div', {'data-service-list': ''});
    const row = list.appendChild(document.createElement('button'));
    press('ArrowRight', {}, tile);
    press('Space', {}, row);
    expect(showState.outputNext).toHaveBeenCalledTimes(2);
  });
});

describe('handleShowKey where a focused control takes the key', () => {
  it.each(['button', 'switch', 'checkbox', 'radio', 'tab'])(
    'leaves Space to a focused %s so that it presses',
    role => {
      const control = appendTo('div', {role, tabindex: '0'});
      const event = press('Space', {}, control);
      expect(showState.outputNext).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    },
  );

  it('leaves Space to a button that has focus and cancels nothing on key up', () => {
    const button = appendTo('button');
    const event = press('Space', {}, button);
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(release('Space', button).defaultPrevented).toBe(false);
  });

  it('leaves the left and right arrows to a focused tab or radio only', () => {
    press('ArrowRight', {}, appendTo('div', {role: 'tab'}));
    press('ArrowLeft', {}, appendTo('div', {role: 'radio'}));
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(showState.outputPrevious).not.toHaveBeenCalled();
    press('ArrowRight', {}, appendTo('button'));
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
  });

  it('still passes the Page keys and the jump keys on from a focused button', () => {
    press('PageDown', {}, appendTo('button'));
    press('PageUp', {}, appendTo('button'));
    press('KeyC', {}, appendTo('button'));
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
    expect(showState.outputPrevious).toHaveBeenCalledTimes(1);
    expect(showState.outputLabel).toHaveBeenCalledTimes(1);
  });

  it('still takes Space from a button of the 장 grid and the 예배 순서 list', () => {
    const grid = appendTo('div', {'data-slide-grid': ''});
    const list = appendTo('div', {'data-service-list': ''});
    press('Space', {}, grid.appendChild(document.createElement('button')));
    press('Space', {}, list.appendChild(document.createElement('button')));
    expect(showState.outputNext).toHaveBeenCalledTimes(2);
  });
});

describe('handleShowKey item keys', () => {
  it('opens the next item with Ctrl Down and swallows the key', () => {
    const event = press('ArrowDown', {ctrlKey: true});
    expect(showState.openNextItem).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('opens the previous item with Ctrl Up', () => {
    press('ArrowUp', {ctrlKey: true});
    expect(showState.openPreviousItem).toHaveBeenCalledTimes(1);
  });

  it('opens the live item with Ctrl L', () => {
    press('KeyL', {ctrlKey: true});
    expect(showState.revealLiveItem).toHaveBeenCalledTimes(1);
  });

  it('outputs nothing for these keys', () => {
    press('ArrowDown', {ctrlKey: true});
    press('ArrowUp', {ctrlKey: true});
    press('KeyL', {ctrlKey: true});
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(showState.outputPrevious).not.toHaveBeenCalled();
    expect(showState.outputLabel).not.toHaveBeenCalled();
  });

  it('works with the 장 grid and the 예배 순서 list in focus', () => {
    const grid = appendTo('div', {'data-slide-grid': ''});
    const list = appendTo('div', {'data-service-list': ''});
    const tile = grid.appendChild(document.createElement('button'));
    const row = list.appendChild(document.createElement('button'));
    press('ArrowDown', {ctrlKey: true}, tile);
    press('ArrowUp', {ctrlKey: true}, row);
    expect(showState.openNextItem).toHaveBeenCalledTimes(1);
    expect(showState.openPreviousItem).toHaveBeenCalledTimes(1);
  });

  it('lets a held key repeat, because it only selects', () => {
    press('ArrowDown', {ctrlKey: true});
    press('ArrowDown', {ctrlKey: true, repeat: true});
    expect(showState.openNextItem).toHaveBeenCalledTimes(2);
  });

  it('ignores other modifiers and the keys without Ctrl', () => {
    press('ArrowDown', {ctrlKey: true, shiftKey: true});
    press('ArrowDown', {ctrlKey: true, altKey: true});
    press('ArrowDown');
    press('KeyL');
    expect(showState.openNextItem).not.toHaveBeenCalled();
    expect(showState.revealLiveItem).not.toHaveBeenCalled();
  });

  it('ignores other keys with Ctrl, which stay free for other commands', () => {
    const event = press('KeyZ', {ctrlKey: true});
    press('ArrowRight', {ctrlKey: true});
    expect(event.defaultPrevented).toBe(false);
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it('opens the live item from a text field, but leaves Ctrl arrows to the caret', () => {
    const input = appendTo('input');
    const textarea = appendTo('textarea');
    const live = press('KeyL', {ctrlKey: true}, input);
    const down = press('ArrowDown', {ctrlKey: true}, textarea);
    const up = press('ArrowUp', {ctrlKey: true}, input);
    expect(showState.revealLiveItem).toHaveBeenCalledTimes(1);
    expect(live.defaultPrevented).toBe(true);
    expect(showState.openNextItem).not.toHaveBeenCalled();
    expect(showState.openPreviousItem).not.toHaveBeenCalled();
    expect(down.defaultPrevented).toBe(false);
    expect(up.defaultPrevented).toBe(false);
  });

  it('runs all three from the thumbnail slider and from a checkbox', () => {
    const slider = appendTo('input', {type: 'range'});
    const checkbox = appendTo('input', {type: 'checkbox'});
    press('ArrowDown', {ctrlKey: true}, slider);
    press('ArrowUp', {ctrlKey: true}, slider);
    press('KeyL', {ctrlKey: true}, slider);
    press('ArrowDown', {ctrlKey: true}, checkbox);
    expect(showState.openNextItem).toHaveBeenCalledTimes(2);
    expect(showState.openPreviousItem).toHaveBeenCalledTimes(1);
    expect(showState.revealLiveItem).toHaveBeenCalledTimes(1);
  });

  it('runs them from a focused button, which keeps only its own keys', () => {
    const button = appendTo('button');
    press('ArrowDown', {ctrlKey: true}, button);
    expect(showState.openNextItem).toHaveBeenCalledTimes(1);
  });

  it('leaves the keys to a text field, an open menu, an IME composition, and a drag', () => {
    press('ArrowDown', {ctrlKey: true}, appendTo('input'));
    press('KeyL', {ctrlKey: true}, appendTo('div', {role: 'menu'}));
    press('ArrowUp', {ctrlKey: true, isComposing: true});
    setColumnDragActive(true);
    press('ArrowDown', {ctrlKey: true});
    expect(showState.openNextItem).not.toHaveBeenCalled();
    expect(showState.openPreviousItem).not.toHaveBeenCalled();
    expect(showState.revealLiveItem).not.toHaveBeenCalled();
  });
});

describe('handleShowKey where another part owns the key', () => {
  it('leaves keys to a text field', () => {
    const event = press('Space', {}, appendTo('input'));
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves keys to an IME composition', () => {
    press('ArrowRight', {isComposing: true});
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it.each(['menu', 'dialog', 'alertdialog'])(
    'leaves keys to an open %s',
    role => {
      const container = appendTo('div', {role});
      const item = container.appendChild(document.createElement('button'));
      press('Space', {}, item);
      expect(showState.outputNext).not.toHaveBeenCalled();
    },
  );
});

describe('handleShowKey during a column drag', () => {
  it('stays inactive for every live key', () => {
    setColumnDragActive(true);
    for (const code of [
      'Space',
      'ArrowRight',
      'ArrowLeft',
      'PageDown',
      'PageUp',
      'KeyC',
    ]) {
      expect(press(code).defaultPrevented).toBe(false);
    }
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(showState.outputPrevious).not.toHaveBeenCalled();
    expect(showState.outputLabel).not.toHaveBeenCalled();
  });

  it('works again when the drag has ended', () => {
    setColumnDragActive(true);
    setColumnDragActive(false);
    press('Space');
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
  });
});

describe('handleShowKey jump keys', () => {
  it('outputs the 이름표 of a bound key and swallows it', () => {
    const event = press('KeyC');
    expect(showState.outputLabel).toHaveBeenCalledWith('후렴');
    expect(event.defaultPrevented).toBe(true);
  });

  it('treats numpad digits as the digits of the top row while Num Lock is on', () => {
    press('Numpad1', {modifierNumLock: true});
    expect(showState.outputLabel).toHaveBeenCalledWith('1절');
  });

  it('ignores numpad digits while Num Lock is off', () => {
    const event = press('Numpad1', {modifierNumLock: false});
    expect(showState.outputLabel).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('still matches the digits of the top row with Num Lock off', () => {
    press('Digit1', {modifierNumLock: false});
    expect(showState.outputLabel).toHaveBeenCalledWith('1절');
  });

  it('ignores a key that no 이름표 uses', () => {
    const event = press('KeyZ');
    expect(showState.outputLabel).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('runs a held jump key once', () => {
    press('KeyC');
    press('KeyC', {repeat: true});
    expect(showState.outputLabel).toHaveBeenCalledTimes(1);
  });

  it('ignores a jump key with a modifier and inside a text field', () => {
    press('KeyC', {ctrlKey: true});
    press('KeyC', {}, appendTo('textarea'));
    expect(showState.outputLabel).not.toHaveBeenCalled();
  });
});

describe('handleShowKeyUp', () => {
  it('cancels the key up of a Space that the live handler took', () => {
    press('Space');
    expect(release('Space').defaultPrevented).toBe(true);
  });

  it('cancels only that one key up', () => {
    press('Space');
    release('Space');
    expect(release('Space').defaultPrevented).toBe(false);
  });

  it('leaves the key up of a Space that was not taken', () => {
    press('Space', {}, appendTo('input'));
    expect(release('Space', appendTo('button')).defaultPrevented).toBe(false);
  });

  it('leaves the key up of a Space during a column drag', () => {
    setColumnDragActive(true);
    press('Space');
    expect(release('Space').defaultPrevented).toBe(false);
  });

  it('ignores other keys', () => {
    press('Space');
    expect(release('Enter').defaultPrevented).toBe(false);
    expect(release('Space').defaultPrevented).toBe(true);
  });
});

describe('click focus', () => {
  function mouseDown(target: Element, button = 0): MouseEvent {
    const event = new MouseEvent('mousedown', {
      button,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'target', {value: target});
    handleShowMouseDown(event);
    return event;
  }

  function focusIn(target: Element): void {
    const event = new FocusEvent('focusin', {bubbles: true});
    Object.defineProperty(event, 'target', {value: target});
    handleShowFocusIn(event);
  }

  function clickAndFocus(target: HTMLElement, button = 0): void {
    mouseDown(target, button);
    target.focus();
    focusIn(target);
  }

  it('never cancels the mouse down, so a native drag still starts', () => {
    const draggable = appendTo('button', {draggable: 'true'});
    expect(mouseDown(draggable).defaultPrevented).toBe(false);
    expect(mouseDown(appendTo('button')).defaultPrevented).toBe(false);
  });

  it('puts the focus back when a plain button takes it', () => {
    const previous = appendTo('button');
    previous.focus();
    clickAndFocus(appendTo('button'));
    expect(document.activeElement).toBe(previous);
  });

  it('blurs the button when nothing else had focus', () => {
    const control = appendTo('button');
    clickAndFocus(control);
    expect(document.activeElement).not.toBe(control);
  });

  it('keeps the focus where it was when a tab or a role button is clicked', () => {
    const previous = appendTo('button');
    previous.focus();
    clickAndFocus(appendTo('div', {role: 'tab', tabindex: '0'}));
    expect(document.activeElement).toBe(previous);
  });

  it('lets text fields, the 장 grid, the 예배 순서 list, and menus take focus', () => {
    const grid = appendTo('div', {'data-slide-grid': ''});
    const list = appendTo('div', {'data-service-list': ''});
    const menu = appendTo('div', {role: 'menu'});
    const targets = [
      appendTo('input'),
      grid.appendChild(document.createElement('button')),
      list.appendChild(document.createElement('button')),
      menu.appendChild(document.createElement('button')),
    ];
    for (const target of targets) {
      appendTo('button').focus();
      clickAndFocus(target);
      expect(document.activeElement).toBe(target);
    }
  });

  it('ignores other mouse buttons', () => {
    appendTo('button').focus();
    const control = appendTo('button');
    clickAndFocus(control, 2);
    expect(document.activeElement).toBe(control);
  });

  it('does nothing for a focus change that no mouse down started', () => {
    appendTo('button').focus();
    const control = appendTo('button');
    control.focus();
    focusIn(control);
    expect(document.activeElement).toBe(control);
  });
});

describe('state that an event may never complete', () => {
  function mouseDown(target: Element): void {
    const event = new MouseEvent('mousedown', {
      button: 0,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'target', {value: target});
    handleShowMouseDown(event);
  }

  function focusIn(target: Element): void {
    const event = new FocusEvent('focusin', {bubbles: true});
    Object.defineProperty(event, 'target', {value: target});
    handleShowFocusIn(event);
  }

  function nativeDragFromFocusedButton(): {
    readonly button: HTMLElement;
    readonly other: HTMLElement;
  } {
    const button = appendTo('button');
    const other = appendTo('button');
    button.focus();
    mouseDown(button);
    return {button, other};
  }

  function tabAwayAndBack(button: HTMLElement, other: HTMLElement): void {
    other.focus();
    button.focus();
    focusIn(button);
  }

  it('does not blur a button that Tab reaches after a native drag from it, on keyboard input', () => {
    const {button, other} = nativeDragFromFocusedButton();
    press('Tab');
    tabAwayAndBack(button, other);
    expect(document.activeElement).toBe(button);
  });

  it('forgets the mouse down when the drag ends', () => {
    const {unmount} = renderHook(() => useShowKeys());
    const {button, other} = nativeDragFromFocusedButton();
    window.dispatchEvent(new Event('dragend'));
    tabAwayAndBack(button, other);
    expect(document.activeElement).toBe(button);
    unmount();
  });

  it('forgets the mouse down when the window loses focus', () => {
    const {unmount} = renderHook(() => useShowKeys());
    const {button, other} = nativeDragFromFocusedButton();
    window.dispatchEvent(new Event('blur'));
    tabAwayAndBack(button, other);
    expect(document.activeElement).toBe(button);
    unmount();
  });

  it('forgets the mouse down when the listeners are removed', () => {
    const {unmount} = renderHook(() => useShowKeys());
    const {button, other} = nativeDragFromFocusedButton();
    unmount();
    tabAwayAndBack(button, other);
    expect(document.activeElement).toBe(button);
  });

  it('still puts the focus back for a click that is followed by its focus-in', () => {
    const previous = appendTo('button');
    previous.focus();
    const control = appendTo('button');
    mouseDown(control);
    control.focus();
    focusIn(control);
    expect(document.activeElement).toBe(previous);
  });

  it('does not cancel a later Space key up after the window lost focus in between', () => {
    const {unmount} = renderHook(() => useShowKeys());
    press('Space');
    window.dispatchEvent(new Event('blur'));
    expect(release('Space', appendTo('button')).defaultPrevented).toBe(false);
    unmount();
  });

  it('does not cancel a key up after the listeners were removed and added again', () => {
    const first = renderHook(() => useShowKeys());
    press('Space');
    first.unmount();
    const second = renderHook(() => useShowKeys());
    expect(release('Space', appendTo('button')).defaultPrevented).toBe(false);
    second.unmount();
  });

  it('forgets a missed Space release when the next Space press is owned by a text field', () => {
    press('Space');
    press('Space', {}, appendTo('input'));
    expect(release('Space', appendTo('input')).defaultPrevented).toBe(false);
  });

  it('keeps the flag for the repeats of a held Space', () => {
    press('Space');
    press('Space', {repeat: true});
    expect(release('Space').defaultPrevented).toBe(true);
  });
});
