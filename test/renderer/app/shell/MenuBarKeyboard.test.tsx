import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {MenuBar} from '@renderer/app/shell/MenuBar';
import {useMenuBarNavigation} from '@renderer/app/shell/menuBarNavigation';
import {useEffect, type JSX} from 'react';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {Dialog} from '@renderer/ui/Dialog';

const NAMES = ['파일', '편집', '보기', '출력', '창', '도움말'] as const;

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.llp = mockLlpApi({});
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

function trigger(name: string): HTMLElement {
  return screen.getByRole('menuitem', {name});
}

function stops(): string[] {
  return NAMES.filter(name => trigger(name).tabIndex === 0);
}

describe('the menu bar keyboard', () => {
  it('is one Tab stop and leaves with Tab', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">before</button>
        <MenuBar title="" />
        <button type="button">after</button>
      </>,
    );
    expect(stops()).toEqual(['파일']);
    screen.getByRole('button', {name: 'before'}).focus();
    await user.tab();
    expect(document.activeElement).toBe(trigger('파일'));
    await user.tab();
    expect(document.activeElement).not.toBe(trigger('편집'));
    expect(NAMES.some(name => trigger(name) === document.activeElement)).toBe(
      false,
    );
  });

  it('moves with the arrows, wraps, goes to the ends, and keeps the Tab stop where it is', async () => {
    const user = userEvent.setup();
    render(<MenuBar title="" />);
    trigger('파일').focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(trigger('편집'));
    expect(stops()).toEqual(['편집']);
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(document.activeElement).toBe(trigger('도움말'));
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(trigger('파일'));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(trigger('도움말'));
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(trigger('파일'));
  });

  it('opens a menu with Down, Enter, or Space, and a held modifier opens nothing', async () => {
    const user = userEvent.setup();
    render(<MenuBar title="" />);
    trigger('보기').focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', {name: '보기'})).toBeDefined();
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(trigger('보기'));
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu', {name: '보기'})).toBeDefined();
    await user.keyboard('{Escape}');
    await user.keyboard(' ');
    expect(screen.getByRole('menu', {name: '보기'})).toBeDefined();
    await user.keyboard('{Escape}');
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(document.activeElement).toBe(trigger('보기'));
  });

  it('follows the arrows from one open menu to its neighbor', async () => {
    const user = userEvent.setup();
    render(<MenuBar title="" />);
    trigger('보기').focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menu', {name: '출력'})).toBeDefined();
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('menu', {name: '편집'})).toBeDefined();
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(trigger('편집'));
  });

  it('keeps → for a submenu row instead of switching menus', async () => {
    const user = userEvent.setup();
    render(<MenuBar title="" />);
    trigger('파일').focus();
    await user.keyboard('{ArrowDown}');
    const menu = screen.getByRole('menu', {name: '파일'});
    for (let step = 0; step < 6; step++) {
      if (
        menu
          .querySelector('[data-pointed="true"]')
          ?.getAttribute('aria-haspopup') === 'menu'
      ) {
        break;
      }
      await user.keyboard('{ArrowDown}');
    }
    await user.keyboard('{ArrowRight}');
    expect(screen.queryByRole('menu', {name: '편집'})).toBeNull();
    expect(screen.getAllByRole('menu').length).toBeGreaterThan(1);
    await user.keyboard('{ArrowLeft}');
    expect(screen.getAllByRole('menu')).toHaveLength(1);
  });

  it('gives focus back to where it was with Esc on a closed menu', async () => {
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="field" />
        <MenuBar title="" />
      </>,
    );
    const field = screen.getByRole('textbox', {name: 'field'});
    field.focus();
    fireEvent.keyDown(window, {key: 'F10'});
    expect(document.activeElement).toBe(trigger('파일'));
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(field);
  });
});

describe('the keys that focus the menu bar', () => {
  it('focuses the bar on F10 and on Alt pressed and released alone', () => {
    render(
      <>
        <input aria-label="field" />
        <MenuBar title="" />
      </>,
    );
    screen.getByRole('textbox', {name: 'field'}).focus();
    fireEvent.keyDown(window, {key: 'F10'});
    expect(document.activeElement).toBe(trigger('파일'));
    screen.getByRole('textbox', {name: 'field'}).focus();
    fireEvent.keyDown(window, {key: 'Alt', altKey: true});
    fireEvent.keyUp(window, {key: 'Alt'});
    expect(document.activeElement).toBe(trigger('파일'));
  });

  it('focuses the first menu even when the Tab stop is on another', async () => {
    const user = userEvent.setup();
    render(<MenuBar title="" />);
    trigger('파일').focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    trigger('보기').blur();
    fireEvent.keyDown(window, {key: 'F10'});
    expect(document.activeElement).toBe(trigger('파일'));
  });

  it('lets Alt with another key or a click reach its own command', () => {
    render(
      <>
        <input aria-label="field" />
        <MenuBar title="" />
      </>,
    );
    const field = screen.getByRole('textbox', {name: 'field'});
    field.focus();
    fireEvent.keyDown(window, {key: 'Alt', altKey: true});
    fireEvent.keyDown(window, {key: 'ArrowRight', altKey: true});
    fireEvent.keyUp(window, {key: 'Alt'});
    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(window, {key: 'Alt', altKey: true});
    fireEvent.pointerDown(window);
    fireEvent.keyUp(window, {key: 'Alt'});
    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(window, {key: 'F10', shiftKey: true});
    expect(document.activeElement).toBe(field);
  });

  it('does nothing while a dialog is open', () => {
    render(
      <>
        <MenuBar title="" />
        <Dialog
          title="질문"
          size="s"
          onCancel={() => undefined}
          primary={{label: '확인', onSelect: () => undefined}}
        >
          <input aria-label="inside" />
        </Dialog>
      </>,
    );
    const inside = screen.getByRole('textbox', {name: 'inside'});
    inside.focus();
    fireEvent.keyDown(window, {key: 'F10'});
    fireEvent.keyDown(window, {key: 'Alt', altKey: true});
    fireEvent.keyUp(window, {key: 'Alt'});
    expect(document.activeElement).toBe(inside);
  });
});

describe('the menu bar stops', () => {
  function Bar({
    disabled,
  }: {
    readonly disabled: readonly string[];
  }): JSX.Element {
    const bar = useMenuBarNavigation(
      ['a', 'b', 'c'] as const,
      name => !disabled.includes(name),
    );
    return (
      <div>
        {(['a', 'b', 'c'] as const).map(name => (
          <button
            key={name}
            type="button"
            {...bar.stopProps(name)}
            onKeyDown={event => bar.onBarKey(name, event)}
          >
            {name}
          </button>
        ))}
      </div>
    );
  }

  it('skips a disabled menu with the arrows and never leaves Tab without a stop', async () => {
    const user = userEvent.setup();
    const view = render(<Bar disabled={['a']} />);
    expect(screen.getByRole('button', {name: 'b'}).tabIndex).toBe(0);
    expect(screen.getByRole('button', {name: 'a'}).tabIndex).toBe(-1);
    view.rerender(<Bar disabled={['b']} />);
    expect(screen.getByRole('button', {name: 'a'}).tabIndex).toBe(0);
    screen.getByRole('button', {name: 'a'}).focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: 'c'}),
    );
    view.rerender(<Bar disabled={['b', 'c']} />);
    screen.getByRole('button', {name: 'c'}).focus();
    view.rerender(<Bar disabled={['a', 'b', 'c']} />);
    expect(
      ['a', 'b', 'c'].every(
        name => screen.getByRole('button', {name}).tabIndex === -1,
      ),
    ).toBe(true);
  });

  it('finds the neighbor among the enabled menus only', () => {
    const found: string[] = [];
    function Probe(): JSX.Element {
      const bar = useMenuBarNavigation(
        ['a', 'b', 'c'] as const,
        name => name !== 'b',
      );
      useEffect(() => {
        found.push(bar.neighbor('a', 1), bar.neighbor('a', -1));
        found.push(bar.neighbor('c', 1), bar.neighbor('c', -1));
      }, [bar]);
      return <span />;
    }
    render(<Probe />);
    expect(found).toEqual(['c', 'c', 'a', 'a']);
  });

  it('keeps the same ref function for a menu between renders', () => {
    const refs: Array<(element: HTMLButtonElement | null) => void> = [];
    function Probe(): JSX.Element {
      const bar = useMenuBarNavigation(['a', 'b'] as const);
      refs.push(bar.stopProps('a').ref);
      return <span />;
    }
    const view = render(<Probe />);
    view.rerender(<Probe />);
    expect(refs).toHaveLength(2);
    expect(refs[1]).toBe(refs[0]);
  });
});
