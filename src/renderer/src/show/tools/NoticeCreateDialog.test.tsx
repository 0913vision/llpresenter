import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseMediaDocument} from '@shared/schema/mediaEdit';
import type {NoticeSet} from '@shared/schema/notices';
import {screensDocument} from '@renderer/screens/testing/documents';
import {NoticeCreateDialog} from './NoticeCreateDialog';

const image = '00000000-0000-4000-8000-000000000001';
const video = '00000000-0000-4000-8000-000000000002';
const parsed = parseMediaDocument({
  name: 'media',
  revision: 1,
  access: 'editable',
  value: {
    format: 'llmedia',
    schemaVersion: 1,
    items: [
      {id: image, name: '그림', kind: 'image', file: 'image.png', size: 1},
      {id: video, name: '영상', kind: 'video', file: 'video.mp4', size: 1},
    ],
    playlists: [
      {
        id: '00000000-0000-4000-8000-000000000003',
        name: '이미지 모음',
        items: [image, image],
      },
      {
        id: '00000000-0000-4000-8000-000000000004',
        name: '영상 포함',
        items: [image, video],
      },
    ],
    audioPlaylists: [],
  },
});
if (!parsed.ok) throw new Error('Invalid media fixture');
const media = parsed.value.value;
const screens = screensDocument();
if (screens.name !== 'screens') throw new Error('Invalid screens fixture');
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('requires a playlist and screen, then copies image order and defaults', () => {
  const save = vi.fn<(item: NoticeSet) => void>();
  render(
    <NoticeCreateDialog
      media={media}
      screens={screens.value.screens}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  const add = screen.getByRole('button', {name: '추가'});
  expect(add.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '이미지 재생목록'}));
  expect(screen.queryByRole('menuitemradio', {name: '영상 포함'})).toBeNull();
  fireEvent.click(screen.getByRole('menuitemradio', {name: '이미지 모음'}));
  expect(add.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '본 화면'}));
  fireEvent.click(add);
  expect(save).toHaveBeenCalledOnce();
  const item = save.mock.calls[0]?.[0];
  expect(item).toMatchObject({
    name: '이미지 모음',
    media: [image, image],
    interval: 8,
    loop: true,
    targets: [screens.value.screens[0]?.id],
  });
});

it('blocks creation when no image playlist is available', () => {
  const save = vi.fn<(item: NoticeSet) => void>();
  render(
    <NoticeCreateDialog
      media={{...media, playlists: []}}
      screens={screens.value.screens}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(save).not.toHaveBeenCalled();
});

it('blocks adding when the selected screen is removed', () => {
  const save = vi.fn<(item: NoticeSet) => void>();
  const view = render(
    <NoticeCreateDialog
      media={media}
      screens={screens.value.screens}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '이미지 재생목록'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '이미지 모음'}));
  fireEvent.click(screen.getByRole('button', {name: '본 화면'}));
  expect(
    screen.getByRole('button', {name: '추가'}).getAttribute('aria-disabled'),
  ).toBeNull();
  view.rerender(
    <NoticeCreateDialog
      media={media}
      screens={screens.value.screens.slice(1)}
      locked={false}
      onCancel={() => undefined}
      onSave={save}
    />,
  );
  expect(
    screen.getByRole('button', {name: '추가'}).getAttribute('aria-disabled'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(save).not.toHaveBeenCalled();
});
