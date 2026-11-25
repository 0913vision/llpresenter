import {fireEvent, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useCloseAway} from '@renderer/ui/popups/useCloseAway';

afterEach(() => {
  document.body.replaceChildren();
});

function setup() {
  const surface = document.createElement('div');
  const inside = document.createElement('button');
  const opener = document.createElement('button');
  const outside = document.createElement('div');
  surface.append(inside);
  document.body.append(surface, opener, outside);
  const onClose = vi.fn();
  renderHook(() => {
    useCloseAway({current: surface}, onClose, target => target === opener);
  });
  return {inside, opener, outside, onClose};
}

it('closes on a press outside the popup, not inside it or on what it keeps', () => {
  const {inside, opener, outside, onClose} = setup();
  fireEvent.pointerDown(inside);
  fireEvent.pointerDown(opener);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.pointerDown(outside);
  expect(onClose).toHaveBeenCalledOnce();
});

it('closes on Escape', () => {
  const {onClose} = setup();
  fireEvent.keyDown(document, {key: 'Enter'});
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(document, {key: 'Escape'});
  expect(onClose).toHaveBeenCalledOnce();
});
