import {renderHook} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {CLICK_FOCUS_ATTRIBUTE} from '@renderer/ui';
import {
  handleShowFocusIn,
  handleShowMouseDown,
  useShowKeys,
} from '@renderer/features/presentation/shortcuts';
import {appendTo} from '@fixtures/renderer/features/presentation/shortcutsFixtures';

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
});
