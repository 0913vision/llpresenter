import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import {THEME_BACKGROUNDS, THEME_DECORATIONS} from '@core/themes/pictures';
import {ThemeImageChoice} from '@renderer/features/screens/themes/ThemeImageChoice';
import {Dialog} from '@renderer/ui/Dialog';

afterEach(cleanup);

it('offers only built-in backgrounds before user images, searches both groups and selects the asset ID', async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  const image = {
    id: createMediaId('10000000-0000-4000-8000-000000000001'),
    name: 'User background',
    kind: 'image' as const,
    file: 'user.png',
    size: 12,
  };
  render(
    <Dialog
      title="Image choice"
      size="s"
      onCancel={vi.fn()}
      primary={{label: '추가', onSelect: vi.fn()}}
    >
      <ThemeImageChoice
        images={[image]}
        selected={undefined}
        reason={undefined}
        change={change}
      />
    </Dialog>,
  );
  await user.click(screen.getByRole('button', {name: '이미지'}));
  expect(
    screen.getByRole('listbox').closest('[data-over-modal]'),
  ).not.toBeNull();
  expect(screen.getByRole('listbox').scrollTop).toBe(0);
  expect(screen.getByText('기본 배경')).toBeTruthy();
  expect(screen.getByText('미디어')).toBeTruthy();
  expect(
    screen
      .getAllByRole('option')
      .map(option => option.getAttribute('aria-label')),
  ).toEqual([...THEME_BACKGROUNDS.map(picture => picture.name), image.name]);
  for (const decoration of THEME_DECORATIONS) {
    expect(screen.queryByRole('option', {name: decoration.name})).toBeNull();
  }
  const search = screen.getByRole('combobox', {name: '검색'});
  await user.type(search, 'User');
  expect(screen.queryByText('기본 배경')).toBeNull();
  expect(screen.getAllByRole('option')).toHaveLength(1);
  await user.clear(search);
  await user.type(search, '설교 제목 두 줄');
  fireEvent.keyDown(search, {key: 'Enter'});
  expect(change).toHaveBeenCalledExactlyOnceWith(THEME_BACKGROUNDS[3]?.id);
});

it('names an embedded decoration without offering it as an image choice', async () => {
  const decoration = THEME_DECORATIONS[0];
  if (decoration === undefined) throw Error('Missing decoration');
  render(
    <ThemeImageChoice
      images={[]}
      selected={decoration.id}
      reason={undefined}
      change={vi.fn()}
    />,
  );
  const button = screen.getByRole('button', {name: '이미지'});
  expect(button.textContent).toBe(decoration.name);
  await userEvent.click(button);
  expect(screen.queryByRole('option', {name: decoration.name})).toBeNull();
  expect(screen.getAllByRole('option')).toHaveLength(7);
});
