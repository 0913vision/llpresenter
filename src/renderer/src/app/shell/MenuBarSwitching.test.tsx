import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {MenuBar} from './MenuBar';

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

function setup() {
  render(<MenuBar title="" />);
  const menubar = screen.getByRole('menubar', {name: '메뉴'});
  const bounds = vi
    .spyOn(menubar, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 0, 400, 30));
  return {menubar, bounds};
}

function outsideCatcher(menu: HTMLElement): HTMLElement {
  const catcher = menu.parentElement?.firstElementChild;
  if (!(catcher instanceof HTMLElement)) {
    throw new Error('Missing menu catcher');
  }
  return catcher;
}

describe('switching menu bar menus', () => {
  it.each([
    {from: '파일', to: '출력'},
    {from: '출력', to: '파일'},
  ])(
    'switches $from to $to on hover and restores focus to the destination on Escape',
    async ({from, to}) => {
      setup();
      const first = screen.getByRole('menuitem', {name: from});
      const next = screen.getByRole('menuitem', {name: to});
      await userEvent.click(first);
      await userEvent.hover(next);
      expect(screen.getByRole('menu', {name: to})).toBeDefined();
      expect(screen.getAllByRole('menu')).toHaveLength(1);
      expect(first.getAttribute('aria-expanded')).toBe('false');
      expect(next.getAttribute('aria-expanded')).toBe('true');
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(next);
    },
  );

  it.each([
    {from: '파일', to: '출력'},
    {from: '출력', to: '파일'},
  ])(
    'switches $from to $to with the first click, including its pointer-enter event',
    async ({from, to}) => {
      setup();
      await userEvent.click(screen.getByRole('menuitem', {name: from}));
      await userEvent.click(screen.getByRole('menuitem', {name: to}));
      const menu = screen.getByRole('menu', {name: to});
      expect(screen.getAllByRole('menu')).toHaveLength(1);
      expect(outsideCatcher(menu).style.top).toBe('30px');
      fireEvent.pointerDown(outsideCatcher(menu));
      expect(screen.queryByRole('menu')).toBeNull();
    },
  );

  it('starts the outside catcher below the menubar and refits it after a resize', async () => {
    const {bounds} = setup();
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    const catcher = outsideCatcher(screen.getByRole('menu', {name: '파일'}));
    expect(catcher.style.top).toBe('30px');
    bounds.mockReturnValue(new DOMRect(0, 0, 400, 45));
    fireEvent.resize(window);
    expect(catcher.style.top).toBe('45px');
    fireEvent.pointerDown(catcher);
    expect(screen.queryByRole('menu')).toBeNull();
    bounds.mockClear();
    fireEvent.resize(window);
    expect(bounds).not.toHaveBeenCalled();
  });

  it('drops the old submenu when switching away and back', async () => {
    setup();
    const file = screen.getByRole('menuitem', {name: '파일'});
    const output = screen.getByRole('menuitem', {name: '출력'});
    await userEvent.click(file);
    await userEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
    expect(screen.getAllByRole('menu')).toHaveLength(2);
    await userEvent.hover(output);
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    await userEvent.hover(file);
    expect(screen.getByRole('menu', {name: '파일'})).toBeDefined();
    expect(screen.queryByRole('menu', {name: '가져오기'})).toBeNull();
  });

  it('keeps a closed menu closed on hover and toggles a clicked heading closed', async () => {
    setup();
    const file = screen.getByRole('menuitem', {name: '파일'});
    await userEvent.hover(file);
    expect(screen.queryByRole('menu')).toBeNull();
    await userEvent.click(file);
    await userEvent.click(file);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
