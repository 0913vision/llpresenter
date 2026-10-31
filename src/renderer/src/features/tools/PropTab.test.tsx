import {settingsDocument} from '@core/testing/settingsDocument';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {PropTab} from './PropTab';
import {stageFixture} from './stageTesting';
import {deferred} from './testing/quickTesting';
import type {EditResult} from '@core/schema/contentEdit';

const id = '00000000-0000-4000-8000-000000000001';
const image = '00000000-0000-4000-8000-000000000002';
const media = parseMediaDocument({
  name: 'media',
  revision: 1,
  access: 'editable',
  value: {
    format: 'llmedia',
    schemaVersion: 1,
    items: [
      {id: image, name: '로고 그림', kind: 'image', file: 'image.png', size: 1},
    ],
    playlists: [],
    audioPlaylists: [],
  },
});
if (!media.ok) throw new Error('Invalid media fixture');
const mediaDocument = media.value;

function fixture() {
  const f = stageFixture([settingsDocument('props', {props: []})]);
  const api = window.llp;
  if (!api) throw new Error('Missing API fixture');
  window.llp = {
    ...api,
    media: {
      ...api.media,
      get: async () => mediaDocument,
      subscribe: () => () => undefined,
    },
  };
  f.edit.mockResolvedValue({ok: true, value: {id: 'props', revision: 2}});
  return f;
}

afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});

it('adds a text prop with a target and sends a settings edit', async () => {
  const f = fixture();
  render(<PropTab />);
  const add = await screen.findByRole('button', {name: '소품 추가'});
  await waitFor(() => expect(add.hasAttribute('disabled')).toBe(false));
  fireEvent.click(add);
  fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
    target: {value: '안내'},
  });
  fireEvent.change(screen.getByRole('textbox', {name: '내용'}), {
    target: {value: '환영합니다'},
  });
  const targets = screen.getByRole('group', {name: '보낼 화면'});
  const target = targets.querySelector('button');
  if (!target) {
    throw new Error('Missing target');
  }
  fireEvent.click(target);
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const request = f.edit.mock.calls[0]?.[0];
  if (request?.name !== 'props') {
    throw new Error('Missing prop edit');
  }
  expect(request.value.props[0]).toMatchObject({
    name: '안내',
    content: {kind: 'text', text: '환영합니다'},
  });
});

it('opens the keyboard context menu and confirms deletion', async () => {
  const f = fixture();
  f.documents.set(
    'props',
    settingsDocument('props', {
      props: [
        {id, name: '로고', content: {kind: 'image', media: image}, targets: []},
      ],
    }),
  );
  render(<PropTab />);
  const tile = await screen.findByRole('option', {name: '로고'});
  tile.focus();
  fireEvent.keyDown(tile, {key: 'ContextMenu'});
  fireEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
  fireEvent.click(screen.getByRole('button', {name: '삭제'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
});

it('adds an image prop only after choosing an image and target', async () => {
  const f = fixture();
  render(<PropTab />);
  const add = await screen.findByRole('button', {name: '소품 추가'});
  await waitFor(() => expect(add.hasAttribute('disabled')).toBe(false));
  fireEvent.click(add);
  fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
    target: {value: '로고'},
  });
  fireEvent.click(screen.getByRole('button', {name: '내용 종류'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '이미지'}));
  const save = screen.getByRole('button', {name: '추가'});
  expect(save.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '이미지'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '로고 그림'}));
  const target = screen
    .getByRole('group', {name: '보낼 화면'})
    .querySelector('button');
  if (!target) throw new Error('Missing target');
  fireEvent.click(target);
  fireEvent.click(save);
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const request = f.edit.mock.calls[0]?.[0];
  if (request?.name !== 'props') {
    throw new Error('Missing prop edit');
  }
  expect(request.value.props[0]?.content).toEqual({
    kind: 'image',
    media: image,
  });
});

it('locks every draft control until an outstanding save finishes', async () => {
  const f = fixture();
  const pending = deferred<EditResult>();
  f.edit.mockReturnValueOnce(pending.promise);
  render(<PropTab />);
  const add = await screen.findByRole('button', {name: '소품 추가'});
  await waitFor(() => expect(add.hasAttribute('disabled')).toBe(false));
  fireEvent.click(add);
  fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
    target: {value: '로고'},
  });
  fireEvent.click(screen.getByRole('button', {name: '내용 종류'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '이미지'}));
  fireEvent.click(screen.getByRole('button', {name: '이미지'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '로고 그림'}));
  fireEvent.click(screen.getByRole('button', {name: '본 화면'}));
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  expect(
    screen.getByRole('textbox', {name: '이름'}).hasAttribute('readonly'),
  ).toBe(true);
  for (const name of ['내용 종류', '이미지', '본 화면']) {
    expect(
      screen.getByRole('button', {name}).getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', {name}));
  }
  expect(screen.queryByRole('menu')).toBeNull();
  expect(
    screen.getByRole('button', {name: '본 화면'}).getAttribute('aria-pressed'),
  ).toBe('true');
  pending.resolve({ok: true, value: {id: 'props', revision: 2}});
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('lists the rows of the ProPresenter prop menu in its order', async () => {
  const f = fixture();
  f.documents.set(
    'props',
    settingsDocument('props', {
      props: [
        {id, name: '로고', content: {kind: 'image', media: image}, targets: []},
      ],
    }),
  );
  render(<PropTab />);
  const tile = await screen.findByRole('option', {name: '로고'});
  const contextTarget = tile;
  fireEvent.contextMenu(contextTarget);
  expect(contextTarget.hasAttribute('data-menu-target')).toBe(true);
  const menu = await screen.findByRole('menu', {name: '소품'});
  const rows = [
    ...menu.querySelectorAll('[role="menuitem"], [role="separator"]'),
  ].map(row =>
    row.getAttribute('role') === 'separator' ? '|' : row.textContent,
  );
  expect(rows).toEqual([
    '모음에 추가',
    '모음으로 옮기기',
    '|',
    '수정…',
    '전환 효과…',
    '자동 지우기',
    '|',
    '잘라내기',
    '복사',
    '붙여넣기',
    '복제',
    '이름 바꾸기',
    '|',
    '삭제',
  ]);
  const enabled = [...menu.querySelectorAll('[role="menuitem"]')]
    .filter(row => row.getAttribute('aria-disabled') !== 'true')
    .map(row => row.textContent);
  expect(enabled).toEqual(['수정…', '삭제']);
});

it('opens disabled editing commands on a read-only prop list', async () => {
  const f = fixture();
  const document = settingsDocument('props', {
    props: [
      {id, name: '로고', content: {kind: 'image', media: image}, targets: []},
    ],
  });
  f.documents.set('props', {...document, access: 'readOnly'});
  render(<PropTab />);
  fireEvent.contextMenu(await screen.findByRole('option', {name: '로고'}));
  expect(screen.getByRole('menu', {name: '소품'})).toBeDefined();
  for (const row of screen.getAllByRole('menuitem')) {
    expect(row.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(row);
  }
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(f.edit).not.toHaveBeenCalled();
});
