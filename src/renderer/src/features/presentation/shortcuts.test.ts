import {renderHook} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {setColumnDragActive} from '@renderer/platform/drag';
import {CLICK_FOCUS_ATTRIBUTE} from '@renderer/ui';
import {seedSampleService} from '../../session/testing/sampleService';
import * as showState from '@renderer/session/show';
import * as bibleKeys from '../bible/verseShortcuts';
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
  vi.spyOn(showState, 'outputHotKey').mockImplementation(() => true);
  vi.spyOn(showState, 'openNextItem').mockImplementation(() => undefined);
  vi.spyOn(showState, 'openPreviousItem').mockImplementation(() => undefined);
  vi.spyOn(showState, 'revealLiveItem').mockImplementation(() => undefined);
  vi.spyOn(bibleKeys, 'outputAdjacentBibleVerse').mockResolvedValue(undefined);
});

afterEach(() => {
  setColumnDragActive(false);
  release('Space');
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('handleShowKey Bible verse keys', () => {
  it.each([
    ['ArrowRight', 'next'],
    ['ArrowLeft', 'previous'],
  ])('adds and outputs the %s endpoint once per press', (code, direction) => {
    expect(press(code, {shiftKey: true}).defaultPrevented).toBe(true);
    expect(press(code, {shiftKey: true, repeat: true}).defaultPrevented).toBe(
      true,
    );
    expect(bibleKeys.outputAdjacentBibleVerse).toHaveBeenCalledExactlyOnceWith(
      direction,
    );
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(showState.outputPrevious).not.toHaveBeenCalled();
  });

  it('leaves text selection, focused controls, dialogs and other modifiers alone', () => {
    for (const target of [
      appendTo('input'),
      appendTo('textarea'),
      appendTo('div', {contenteditable: 'true'}),
      appendTo('div', {role: 'tab'}),
      appendTo('div', {role: 'radio'}),
      appendTo('div', {role: 'dialog'}),
      appendTo('div', {role: 'menu'}),
    ]) {
      expect(
        press('ArrowRight', {shiftKey: true}, target).defaultPrevented,
      ).toBe(false);
    }
    press('ArrowRight', {shiftKey: true, ctrlKey: true});
    press('ArrowLeft', {shiftKey: true, altKey: true});
    press('ArrowRight', {shiftKey: true, metaKey: true});
    press('ArrowRight', {shiftKey: true, isComposing: true});
    setColumnDragActive(true);
    press('ArrowRight', {shiftKey: true});
    expect(bibleKeys.outputAdjacentBibleVerse).not.toHaveBeenCalled();
  });

  it('passes Shift arrows from the slide grid and service list', () => {
    const grid = appendTo('div', {role: 'listbox'});
    press(
      'ArrowRight',
      {shiftKey: true},
      grid.appendChild(document.createElement('button')),
    );
    expect(bibleKeys.outputAdjacentBibleVerse).toHaveBeenCalledExactlyOnceWith(
      'next',
    );
  });
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
    const grid = appendTo('div', {role: 'listbox'});
    const tile = grid.appendChild(document.createElement('button'));
    const list = appendTo('div', {role: 'listbox'});
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

  it('still passes Page keys on from a focused button', () => {
    press('PageDown', {}, appendTo('button'));
    press('PageUp', {}, appendTo('button'));
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
    expect(showState.outputPrevious).toHaveBeenCalledTimes(1);
  });

  it('still takes Space from a button of the 장 grid and the 예배 순서 list', () => {
    const grid = appendTo('div', {role: 'listbox'});
    const list = appendTo('div', {role: 'listbox'});
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
  });

  it('works with the 장 grid and the 예배 순서 list in focus', () => {
    const grid = appendTo('div', {role: 'listbox'});
    const list = appendTo('div', {role: 'listbox'});
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
  });

  it('works again when the drag has ended', () => {
    setColumnDragActive(true);
    setColumnDragActive(false);
    press('Space');
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
  });
});

describe('handleShowKey slide keys', () => {
  it('leaves source-slide keys to the mounted shortcut hook', () => {
    vi.spyOn(showState, 'hasSlideHotKey').mockReturnValue(true);
    expect(press('KeyC').defaultPrevented).toBe(false);
    expect(showState.outputHotKey).not.toHaveBeenCalled();
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

  it('keeps the focus where it was when a tile of an unmarked list is clicked', () => {
    const strip = appendTo('div', {role: 'listbox'});
    const tile = strip.appendChild(document.createElement('button'));
    const previous = appendTo('button');
    previous.focus();
    clickAndFocus(tile);
    expect(document.activeElement).toBe(previous);
  });

  it('lets text fields, the marked lists, and menus take focus', () => {
    const grid = appendTo('div', {
      role: 'listbox',
      [CLICK_FOCUS_ATTRIBUTE]: '',
    });
    const list = appendTo('div', {
      role: 'listbox',
      [CLICK_FOCUS_ATTRIBUTE]: '',
    });
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

describe('label click focus', () => {
  function labeledButton(association: 'wrapped' | 'for' = 'wrapped') {
    const label = document.body.appendChild(document.createElement('label'));
    const text = label.appendChild(document.createElement('span'));
    text.textContent = 'Name';
    const control = document.createElement('button');
    if (association === 'wrapped') label.appendChild(control);
    else {
      control.id = 'label-control';
      label.htmlFor = control.id;
      document.body.appendChild(control);
    }
    return {label, text, control};
  }

  function dispatchMouse(type: string, target: Element): void {
    target.dispatchEvent(
      new MouseEvent(type, {bubbles: true, cancelable: true}),
    );
  }

  it.each(['wrapped', 'for'] as const)(
    'keeps focus through mouseup and the forwarded click of a %s label',
    async association => {
      renderHook(() => useShowKeys());
      const previous = appendTo('button');
      const {text, control} = labeledButton(association);
      const clicked = vi.fn();
      control.addEventListener('click', clicked);
      previous.focus();
      await userEvent.click(text);
      expect(clicked).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(previous);
    },
  );

  it('clears the label press when release is outside the label', () => {
    renderHook(() => useShowKeys());
    appendTo('button').focus();
    const {text, control} = labeledButton();
    dispatchMouse('mousedown', text);
    dispatchMouse('mouseup', document.body);
    control.focus();
    expect(document.activeElement).toBe(control);
  });

  it('clears a cancelled label click before a later focus change', async () => {
    renderHook(() => useShowKeys());
    appendTo('button').focus();
    const {text, control} = labeledButton();
    text.addEventListener('click', event => event.preventDefault(), {
      once: true,
    });
    await userEvent.click(text);
    control.focus();
    expect(document.activeElement).toBe(control);
  });

  it('clears the pending label press on keyboard input', () => {
    renderHook(() => useShowKeys());
    appendTo('button').focus();
    const {text, control} = labeledButton();
    dispatchMouse('mousedown', text);
    dispatchMouse('mouseup', text);
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {code: 'Tab', bubbles: true}),
    );
    control.focus();
    expect(document.activeElement).toBe(control);
  });

  it.each(['field', 'window'] as const)(
    'clears a label press before a %s handler swallows keydown',
    scope => {
      renderHook(() => useShowKeys());
      appendTo('button').focus();
      const {text, control} = labeledButton();
      dispatchMouse('mousedown', text);
      dispatchMouse('mouseup', text);
      const field = appendTo('input');
      field.focus();
      const owner = scope === 'field' ? field : window;
      owner.addEventListener(
        'keydown',
        event => {
          event.preventDefault();
          event.stopPropagation();
        },
        {once: true, capture: scope === 'window'},
      );
      field.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'Tab',
          bubbles: true,
          cancelable: true,
        }),
      );
      control.focus();
      expect(document.activeElement).toBe(control);
    },
  );

  it('releases the label state and click listener when Show unmounts', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const {unmount} = renderHook(() => useShowKeys());
    const {text, control} = labeledButton();
    appendTo('button').focus();
    dispatchMouse('mousedown', text);
    dispatchMouse('mouseup', text);
    unmount();
    expect(remove).toHaveBeenCalledWith('click', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function), {
      capture: true,
    });
    renderHook(() => useShowKeys());
    control.focus();
    expect(document.activeElement).toBe(control);
  });

  it('lets a label still focus its text field', async () => {
    renderHook(() => useShowKeys());
    const label = document.body.appendChild(document.createElement('label'));
    const text = label.appendChild(document.createElement('span'));
    text.textContent = 'Field';
    const input = label.appendChild(document.createElement('input'));
    await userEvent.click(text);
    expect(document.activeElement).toBe(input);
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
