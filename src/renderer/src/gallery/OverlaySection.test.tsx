import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it} from 'vitest';
import {OverlaySection} from './OverlaySection';

it('marks the gallery context target for pointer and keyboard menus', () => {
  render(<OverlaySection />);
  const target = screen.getByRole('button', {name: '찬양'});
  fireEvent.contextMenu(target);
  expect(target.hasAttribute('data-menu-target')).toBe(true);
  fireEvent.keyDown(screen.getByRole('menu'), {key: 'Escape'});
  expect(target.hasAttribute('data-menu-target')).toBe(false);
  fireEvent.keyDown(target, {key: 'F10', shiftKey: true});
  expect(target.hasAttribute('data-menu-target')).toBe(true);
});
