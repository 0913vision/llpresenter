import {renderHook} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {CLICK_FOCUS_ATTRIBUTE} from '@renderer/ui';
import {
  handleShowFocusIn,
  handleShowMouseDown,
  useShowKeys,
} from '@renderer/features/presentation/keyboard/shortcuts';
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

  it('returns focus from a media list to the slide grid in 진행', () => {
    const show = appendTo('main', {'data-workspace-layout': 'show'});
    const keeper = show.appendChild(document.createElement('div'));
    keeper.dataset.showSlideGrid = 'true';
    const grid = keeper.appendChild(document.createElement('div'));
    grid.setAttribute('role', 'listbox');
    grid.setAttribute('aria-label', '슬라이드');
    grid.tabIndex = 0;
    const media = show.appendChild(document.createElement('div'));
    media.setAttribute('role', 'listbox');
    media.setAttribute(CLICK_FOCUS_ATTRIBUTE, '');
    const option = media.appendChild(document.createElement('div'));
    option.setAttribute('role', 'option');
    option.tabIndex = 0;
    grid.focus();
    clickAndFocus(option);
    expect(document.activeElement).toBe(grid);
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

it('returns from a clicked panel header to the slide grid', async () => {
  renderHook(() => useShowKeys());
  const show = appendTo('main', {'data-workspace-layout': 'show'});
  const keeper = show.appendChild(document.createElement('div'));
  keeper.dataset.showSlideGrid = 'true';
  const grid = keeper.appendChild(document.createElement('div'));
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', '슬라이드');
  grid.tabIndex = 0;
  const field = show.appendChild(document.createElement('input'));
  const header = show.appendChild(document.createElement('header'));
  field.focus();
  await userEvent.click(header);
  expect(document.activeElement).toBe(grid);
});

it('keeps keyboard focus on a control activated by Enter', async () => {
  renderHook(() => useShowKeys());
  const show = appendTo('main', {'data-workspace-layout': 'show'});
  const keeper = show.appendChild(document.createElement('div'));
  keeper.dataset.showSlideGrid = 'true';
  const grid = keeper.appendChild(document.createElement('div'));
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', '슬라이드');
  grid.tabIndex = 0;
  const button = show.appendChild(document.createElement('button'));
  button.focus();
  await userEvent.keyboard('{Enter}');
  expect(document.activeElement).toBe(button);
});

it('returns to the grid when a toolbar button is clicked from a field', async () => {
  renderHook(() => useShowKeys());
  const show = appendTo('main', {'data-workspace-layout': 'show'});
  const keeper = show.appendChild(document.createElement('div'));
  keeper.dataset.showSlideGrid = 'true';
  const grid = keeper.appendChild(document.createElement('div'));
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', '슬라이드');
  grid.tabIndex = 0;
  const field = show.appendChild(document.createElement('input'));
  const toolbar = appendTo('header', {'data-workspace-toolbar': ''});
  const button = toolbar.appendChild(document.createElement('button'));
  field.focus();
  await userEvent.click(button);
  expect(document.activeElement).toBe(grid);
});

it('keeps focus on the element restored by a popover', async () => {
  renderHook(() => useShowKeys());
  const show = appendTo('main', {'data-workspace-layout': 'show'});
  const keeper = show.appendChild(document.createElement('div'));
  keeper.dataset.showSlideGrid = 'true';
  const grid = keeper.appendChild(document.createElement('div'));
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', '슬라이드');
  grid.tabIndex = 0;
  const button = show.appendChild(document.createElement('button'));
  const popover = document.body.appendChild(document.createElement('div'));
  popover.setAttribute('role', 'dialog');
  const option = popover.appendChild(document.createElement('button'));
  option.focus();
  button.focus();
  popover.remove();
  await Promise.resolve();
  expect(document.activeElement).toBe(button);
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
