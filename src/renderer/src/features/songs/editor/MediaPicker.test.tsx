import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import {MediaPicker} from './MediaPicker';

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--size-row-menu');
});

it('clears pointer highlighting without changing selection and keeps keyboard pointing on leave', () => {
  document.documentElement.style.setProperty('--size-row-menu', '28px');
  const anchor = document.createElement('button');
  const id = createMediaId('00000000-0000-4000-8000-000000000001');
  render(
    <MediaPicker
      anchor={anchor}
      items={[{id, name: '배경', kind: 'image', file: 'sample', size: 0}]}
      selected={undefined}
      query=""
      onQueryChange={vi.fn()}
      onSelect={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  const search = screen.getByRole('combobox', {name: '검색'});
  const none = screen.getByRole('option', {name: '없음'});
  const image = screen.getByRole('option', {name: '배경'});
  fireEvent.pointerMove(image);
  expect(image.getAttribute('data-pointed')).toBe('true');
  fireEvent.pointerLeave(
    image.closest('[role="listbox"]')?.parentElement ?? image,
  );
  expect(image.getAttribute('data-pointed')).not.toBe('true');
  expect(none.getAttribute('aria-selected')).toBe('true');
  fireEvent.keyDown(search, {key: 'ArrowUp'});
  fireEvent.pointerLeave(none);
  expect(none.getAttribute('data-pointed')).toBe('true');
  expect(search.getAttribute('aria-activedescendant')).toBe(none.id);
});
