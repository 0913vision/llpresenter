import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import {MediaPicker} from '@renderer/features/songs/editor/MediaPicker';

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--size-row-menu');
});

it('supports a required image choice and keeps empty search results from selecting absence', () => {
  const onSelect = vi.fn();
  const props = {
    anchor: document.createElement('button'),
    selected: undefined,
    query: '',
    onQueryChange: vi.fn(),
    onSelect,
    onClose: vi.fn(),
    allowNone: false,
    label: '그림',
  };
  const id = createMediaId('00000000-0000-4000-8000-000000000001');
  const view = render(
    <MediaPicker
      {...props}
      items={[{id, name: '점검 그림', kind: 'image', file: 'sample', size: 0}]}
    />,
  );
  expect(screen.queryByRole('option', {name: '없음'})).toBeNull();
  fireEvent.keyDown(screen.getByRole('combobox'), {key: 'Enter'});
  expect(onSelect).toHaveBeenCalledWith(id);
  onSelect.mockClear();
  view.rerender(<MediaPicker {...props} items={[]} />);
  expect(screen.queryByRole('option')).toBeNull();
  fireEvent.keyDown(screen.getByRole('combobox'), {key: 'ArrowDown'});
  fireEvent.keyDown(screen.getByRole('combobox'), {key: 'Enter'});
  expect(onSelect).not.toHaveBeenCalled();
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

it('windows inherited background choices, wraps across the divider and clamps after a catalog update', () => {
  document.documentElement.style.setProperty('--size-row-menu', '28px');
  const items = Array.from({length: 40}, (_, index) => ({
    id: createMediaId(
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    ),
    name: `Invented ${index}`,
    kind: 'image' as const,
    file: 'sample',
    size: 0,
  }));
  const selected = items.at(-1);
  if (selected === undefined) throw new Error('Missing fixture');
  const props = {
    anchor: document.createElement('button'),
    items,
    selected: selected.id,
    defaultChoice: {label: '곡 기본값', detail: 'Source default'},
    query: '',
    onQueryChange: vi.fn(),
    onSelect: vi.fn(),
    onClose: vi.fn(),
  };
  const {rerender} = render(<MediaPicker {...props} />);
  const search = screen.getByRole('combobox');
  expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(12);
  expect(search.getAttribute('aria-activedescendant')).toBe(
    screen.getByRole('option', {name: selected.name}).id,
  );
  fireEvent.keyDown(search, {key: 'ArrowDown'});
  const inherited = screen.getByRole('option', {name: '곡 기본값'});
  expect(search.getAttribute('aria-activedescendant')).toBe(inherited.id);
  fireEvent.keyDown(search, {key: 'ArrowUp'});
  rerender(<MediaPicker {...props} items={[]} />);
  fireEvent.scroll(screen.getByRole('listbox'), {target: {scrollTop: 0}});
  expect(search.getAttribute('aria-activedescendant')).toBe(inherited.id);
  expect(screen.queryByRole('separator')).toBeNull();
  fireEvent.keyDown(search, {key: 'Enter'});
  expect(props.onSelect).toHaveBeenCalledExactlyOnceWith(undefined);
});

it('keeps grouped backgrounds keyboard reachable across the virtual user list', () => {
  document.documentElement.style.setProperty('--size-row-menu', '28px');
  const items = Array.from({length: 60}, (_, index) => ({
    id: createMediaId(
      `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    ),
    name: `User ${index}`,
    kind: 'image' as const,
    file: 'user.png',
    size: 1,
  }));
  const builtin = {
    id: createMediaId('20000000-0000-4000-8000-000000000001'),
    name: 'Built-in',
    kind: 'image' as const,
  };
  const onSelect = vi.fn();
  render(
    <MediaPicker
      anchor={document.createElement('button')}
      items={items}
      leadingGroup={{label: '기본 배경', items: [builtin]}}
      itemsLabel="미디어"
      selected={items.at(-1)?.id}
      query=""
      onQueryChange={vi.fn()}
      onSelect={onSelect}
      onClose={vi.fn()}
      allowNone={false}
    />,
  );
  const search = screen.getByRole('combobox', {name: '검색'});
  expect(screen.getAllByRole('option').length).toBeLessThan(16);
  expect(screen.getByRole('option', {name: 'User 59'})).toBeTruthy();
  fireEvent.keyDown(search, {key: 'ArrowDown'});
  expect(search.getAttribute('aria-activedescendant')).toBe(
    screen.getByRole('option', {name: 'Built-in'}).id,
  );
  fireEvent.keyDown(search, {key: 'Enter'});
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(builtin.id);
});
