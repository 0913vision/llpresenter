import {afterEach, describe, expect, it} from 'vitest';
import {returnFocus} from '@renderer/ui/returnFocus';

afterEach(() => document.body.replaceChildren());

describe('returnFocus in 진행', () => {
  function frame(): HTMLElement {
    const show = document.createElement('main');
    show.dataset.workspaceLayout = 'show';
    show.innerHTML =
      '<div data-show-slide-grid><div role="listbox" aria-label="슬라이드" tabindex="0"></div></div>';
    document.body.append(show);
    const grid = show.querySelector('[role="listbox"]');
    if (!(grid instanceof HTMLElement)) throw new Error('Missing grid');
    return grid;
  }

  it('returns a menu or dialog opener to the slide grid', () => {
    const grid = frame();
    const button = document.body.appendChild(document.createElement('button'));
    returnFocus(button);
    expect(document.activeElement).toBe(grid);
  });

  it('returns to a text field that opened the overlay', () => {
    frame();
    const field = document.body.appendChild(document.createElement('input'));
    returnFocus(field);
    expect(document.activeElement).toBe(field);
  });

  it('keeps a menu opened inside a dialog in the dialog', () => {
    frame();
    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.setAttribute('role', 'dialog');
    const button = dialog.appendChild(document.createElement('button'));
    returnFocus(button);
    expect(document.activeElement).toBe(button);
  });
});
