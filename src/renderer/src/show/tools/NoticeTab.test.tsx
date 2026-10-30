import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseMediaDocument} from '@shared/schema/mediaEdit';
import {settingsDocument, MAIN_ID} from '@renderer/screens/testing/documents';
import {deferred} from '../quick/quickTesting';
import type {EditResult} from '@shared/schema/contentEdit';
import {NoticeTab} from './NoticeTab';
import {stageFixture} from './stageTesting';
import {renderedToolMenuRows} from './toolMenuTesting';

const id = '00000000-0000-4000-8000-000000000001';
const image = '00000000-0000-4000-8000-000000000002';
const parsed = parseMediaDocument({
  name: 'media',
  revision: 1,
  access: 'editable',
  value: {
    format: 'llmedia',
    schemaVersion: 1,
    items: [
      {id: image, name: '그림', kind: 'image', file: 'image.png', size: 1},
    ],
    playlists: [
      {
        id: '00000000-0000-4000-8000-000000000003',
        name: '공지 그림',
        items: [image],
      },
    ],
    audioPlaylists: [],
  },
});

it('does not replace a newer selection after a pending creation is dismissed', async () => {
  const other = {
    ...notice,
    id: '00000000-0000-4000-8000-000000000004',
    name: '다른 공지',
  };
  const f = fixture([notice, other]);
  const pending = deferred<EditResult>();
  f.edit.mockReturnValueOnce(pending.promise);
  render(<NoticeTab />);
  const add = await screen.findByRole('button', {name: '공지 추가'});
  await waitFor(() =>
    expect(add.getAttribute('aria-disabled')).not.toBe('true'),
  );
  fireEvent.click(add);
  fireEvent.click(screen.getByRole('button', {name: '이미지 재생목록'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '공지 그림'}));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {name: '본 화면'}),
  );
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', {name: '취소'}));
  fireEvent.click(screen.getByRole('button', {name: '공지 세트'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '다른 공지'}));
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'notices') throw new Error('Missing notice edit');
  act(() => f.push(settingsDocument('notices', {sets: edit.value.sets}, 2)));
  pending.resolve({ok: true, value: {id: 'notices', revision: 2}});
  await waitFor(() =>
    expect(add.getAttribute('aria-disabled')).not.toBe('true'),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '공지 세트'}).textContent,
    ).toContain('다른 공지'),
  );
});
if (!parsed.ok) throw new Error('Invalid media fixture');
const media = parsed.value;
const notice = {
  id,
  name: '주일 공지',
  media: [image],
  interval: 8,
  loop: true,
  targets: [MAIN_ID],
};

function fixture(sets: readonly object[] = [notice]) {
  const f = stageFixture([settingsDocument('notices', {sets})]);
  const api = window.llp;
  if (!api) throw new Error('Missing API');
  window.llp = {
    ...api,
    media: {
      ...api.media,
      get: async () => media,
      subscribe: () => () => undefined,
    },
  };
  f.edit.mockResolvedValue({ok: true, value: {id: 'notices', revision: 2}});
  return f;
}

it.each([false, true])(
  'lists notice-set rows in order when locked=%s',
  async locked => {
    const f = fixture();
    const stored = f.documents.get('notices');
    if (!stored) throw new Error('Missing notice fixture');
    if (locked) f.documents.set('notices', {...stored, access: 'readOnly'});
    render(<NoticeTab />);
    const target = await screen.findByRole('button', {name: '공지 세트'});
    await waitFor(() => expect(target.textContent).toContain('주일 공지'));
    fireEvent.contextMenu(target);
    expect(
      renderedToolMenuRows(screen.getByRole('menu', {name: '공지 세트'})),
    ).toEqual(['복제', '이름 바꾸기', '|', '삭제']);
    if (locked) {
      for (const row of screen.getAllByRole('menuitem')) {
        expect(row.getAttribute('aria-disabled')).toBe('true');
        fireEvent.click(row);
      }
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(f.edit).not.toHaveBeenCalled();
    }
  },
);
afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});

it('starts the chosen image and saves repeat changes', async () => {
  const f = fixture();
  render(<NoticeTab />);
  fireEvent.click(await screen.findByRole('option', {name: '그림'}));
  expect(f.send).toHaveBeenCalledWith({
    type: 'notice.start',
    noticeId: id,
    position: 0,
  });
  const repeat = screen.getByRole('button', {name: '반복'});
  await waitFor(() =>
    expect(repeat.getAttribute('aria-disabled')).not.toBe('true'),
  );
  fireEvent.click(repeat);
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'notices') throw new Error('Missing notice edit');
  expect(edit.value.sets[0]?.loop).toBe(false);
});

it('places interval and repeat before the images and targets after them', async () => {
  fixture();
  render(<NoticeTab />);
  const grid = await screen.findByRole('listbox', {name: '공지 이미지'});
  const interval = screen.getByRole('button', {name: '8초'});
  const targets = screen.getByRole('group', {name: '보낼 화면'});
  expect(
    interval.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    grid.compareDocumentPosition(targets) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it('renames a set with its keyboard context menu', async () => {
  const f = fixture();
  render(<NoticeTab />);
  const select = await screen.findByRole('button', {name: '공지 세트'});
  await waitFor(() => expect(select.textContent).toContain('주일 공지'));
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', {name: '공지 추가'})
        .getAttribute('aria-disabled'),
    ).not.toBe('true'),
  );
  fireEvent.keyDown(select, {key: 'ContextMenu'});
  fireEvent.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
  fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
    target: {value: '새 공지'},
  });
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'notices') throw new Error('Missing notice edit');
  expect(edit.value.sets[0]?.name).toBe('새 공지');
});

it('confirms before deleting the selected set', async () => {
  const f = fixture();
  render(<NoticeTab />);
  const select = await screen.findByRole('button', {name: '공지 세트'});
  await waitFor(() => expect(select.textContent).toContain('주일 공지'));
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', {name: '공지 추가'})
        .getAttribute('aria-disabled'),
    ).not.toBe('true'),
  );
  fireEvent.contextMenu(select);
  fireEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
  expect(f.edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '삭제'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'notices') throw new Error('Missing notice edit');
  expect(edit.value.sets).toEqual([]);
});

it('creates a notice from a playlist and locks every draft control during save', async () => {
  const f = fixture([]);
  const pending = deferred<EditResult>();
  f.edit.mockReturnValueOnce(pending.promise);
  render(<NoticeTab />);
  const add = await screen.findByRole('button', {name: '공지 추가'});
  await waitFor(() =>
    expect(add.getAttribute('aria-disabled')).not.toBe('true'),
  );
  fireEvent.click(add);
  fireEvent.click(screen.getByRole('button', {name: '이미지 재생목록'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '공지 그림'}));
  fireEvent.click(screen.getByRole('button', {name: '본 화면'}));
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  expect(
    screen.getByRole('button', {name: '본 화면'}).getAttribute('aria-disabled'),
  ).toBe('true');
  expect(
    screen
      .getByRole('button', {name: '이미지 재생목록'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
  expect(
    screen.getByRole('textbox', {name: '이름'}).hasAttribute('readonly'),
  ).toBe(true);
  pending.resolve({ok: true, value: {id: 'notices', revision: 2}});
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
