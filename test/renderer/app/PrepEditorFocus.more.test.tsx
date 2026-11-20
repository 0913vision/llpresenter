import {useContext, useLayoutEffect, useRef} from 'react';
import {PictureReadiness} from '@renderer/rendering/PictureReadiness';
import * as songEditorRequests from '@renderer/features/songs/editor/songEditorRequests';
import {MEDIA_DRAG_MIME} from '@renderer/features/media/mediaDrag';
import {fixtureMedia} from '@fixtures/core/mediaList';
import {serviceOrderEditsFor} from '@renderer/session/serviceOrderEdits';
import {ELEMENT_DRAG_MIME} from '@renderer/features/service/items/paletteItems';
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, vi} from 'vitest';
import {
  fixtureItems,
  fixtureServiceId,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {useShow} from '@renderer/session/show';
import {isItemOfKind} from '@core/schema/service';
import {mockMenuRowHeight} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {
  setup,
  commandList,
} from '@fixtures/renderer/app/prepEditorFocusTesting';

it.each(['double-click', 'Enter'] as const)(
  'focuses library commands opened by %s and returns to its row',
  async path => {
    const f = setup();
    await userEvent.click(screen.getByRole('tab', {name: '곡'}));
    const library = screen.getByRole('listbox', {name: '라이브러리 곡'});
    const row = await within(library).findByRole('option', {
      name: f.first.song.title,
    });
    if (path === 'double-click') await userEvent.dblClick(row);
    else {
      row.focus();
      await userEvent.keyboard('{Enter}');
    }
    await waitFor(() => expect(document.activeElement).toBe(commandList()));
    act(() =>
      document.activeElement instanceof HTMLElement
        ? document.activeElement.blur()
        : undefined,
    );
    fireEvent.keyDown(document.body, {
      key: 'Escape',
      code: 'Escape',
      isComposing: true,
    });
    expect(screen.queryByRole('listbox', {name: '예배 순서'})).toBeNull();
    fireEvent.keyDown(document.body, {key: 'Escape', code: 'Escape'});
    await screen.findByRole('listbox', {name: '예배 순서'});
    expect(document.activeElement).toBe(row);
  },
);

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    ready = () => true;
    revealIncomplete = () => undefined;
    render = vi.fn();
    dispose = vi.fn();
  },
}));
vi.mock(
  '@renderer/rendering/pictures/Picture',
  () => import('@fixtures/renderer/picture'),
);
vi.mock('@renderer/rendering/SlidePicture', () => ({
  SlidePicture: () => {
    const ready = useContext(PictureReadiness);
    const source = useRef({});
    useLayoutEffect(() => ready?.(source.current), [ready]);
    return null;
  },
}));

// NOTE(0913vision): jsdom has no layout for the hidden preparation frame.
vi.mock('@renderer/rendering/drawnPictures', () => ({
  drawnPictures: () => 1,
}));

it('selects the source slide and focuses commands after opening from the right grid', async () => {
  const f = setup();
  await userEvent.click(screen.getByRole('option', {name: /Service song/}));
  await screen.findByRole('tab', {name: '슬라이드'});
  const details = screen.getByRole('region', {name: '세부정보'});
  await within(details).findByText(
    `곡, 슬라이드 ${f.first.song.slides.length}개`,
  );
  expect(within(details).getByText('1')).toBeTruthy();
  await userEvent.click(within(details).getByRole('tab', {name: '슬라이드'}));
  const grid = within(details).getByRole('listbox', {name: '슬라이드'});
  const slide = within(grid).getAllByRole('option')[1];
  if (slide === undefined) throw new Error('Missing second grid slide');
  await userEvent.dblClick(slide);
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  const model = f.session.editor
    ?.getSnapshot()
    .session?.slideModel.getSnapshot();
  expect([...(model?.selection.ids ?? [])]).toEqual([
    f.first.song.slides[1]?.id,
  ]);
});

it('shows a library song on a single click without opening its editor', async () => {
  const f = setup();
  const response = {
    songId: f.first.song.id,
    songRevision: f.first.revision,
    title: f.first.song.title,
    readOnly: false,
    tiles: f.first.song.slides.map(slide => ({
      label: slide.label ?? null,
      labelColor: 'none' as const,
      lines: slide.lines,
    })),
  };
  let release: (() => void) | undefined;
  const pending = new Promise<typeof response>(resolve => {
    release = () => resolve(response);
  });
  const showSong = vi
    .spyOn(f.api.library, 'showSong')
    .mockReturnValueOnce(pending)
    .mockResolvedValue(response);
  const live = vi.spyOn(f.api.live, 'send');
  await userEvent.click(screen.getByRole('tab', {name: '곡'}));
  const library = screen.getByRole('listbox', {name: '라이브러리 곡'});
  await userEvent.click(
    await within(library).findByRole('option', {name: f.first.song.title}),
  );
  await waitFor(() =>
    expect(showSong).toHaveBeenCalledWith({songId: f.first.song.id}),
  );
  if (release === undefined) throw new Error('Missing library response');
  await act(async () => {
    release?.();
    await pending;
  });
  await waitFor(
    () => expect(useShow.getState().librarySong?.songId).toBe(f.first.song.id),
    {timeout: 5000},
  );
  await screen.findByRole('tab', {name: '슬라이드'}, {timeout: 5000});
  const details = screen.getByRole('region', {name: '세부정보'});
  await within(details).findByText(
    `곡, 슬라이드 ${f.first.song.slides.length}개`,
  );
  expect(within(details).queryByRole('group', {name: '이번 예배'})).toBeNull();
  expect(songEditorRequests.requestSongEditor).not.toHaveBeenCalled();
  expect(live).not.toHaveBeenCalled();
});

it('keeps Ctrl N in the title and enters the first slide text with Enter', async () => {
  setup();
  await userEvent.keyboard('{Control>}n{/Control}');
  const title = await screen.findByRole('textbox', {name: '곡 제목'});
  expect(document.activeElement).toBe(title);
  await userEvent.keyboard('{Enter}');
  expect(document.activeElement).toBe(
    screen.getByRole('textbox', {name: '슬라이드 1 제목 및 부제'}),
  );
});

it('keeps the song settings paired while the slides editor is still opening', async () => {
  const f = setup();
  await userEvent.dblClick(screen.getByRole('option', {name: /Service song/}));
  await screen.findByRole('region', {name: '곡 편집'});
  const session = f.session.editor?.getSnapshot().session;
  let finish: (() => void) | undefined;
  vi.mocked(f.api.slidesEditor.open).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = () => resolve({ok: true, value: undefined});
      }),
  );
  const settings = screen.getByRole('group', {
    name: '이번 예배',
  });
  const before = settings.textContent;
  await userEvent.click(screen.getByRole('option', {name: /Sermon item/}));
  await waitFor(() =>
    expect(f.session.items?.getSnapshot().item?.id).toBe(fixtureItems.lost),
  );
  expect(f.session.editor?.getSnapshot().session).toBe(session);
  expect(screen.getByRole('region', {name: '곡 편집'})).toBeTruthy();
  expect(screen.getByRole('group', {name: '이번 예배'}).textContent).toBe(
    before,
  );
  act(() => finish?.());
});

it('focuses the new song title when Ctrl N replaces an existing song', async () => {
  const f = setup(false, false, true);
  await userEvent.dblClick(screen.getByRole('option', {name: /Service song/}));
  await waitFor(() =>
    expect(f.session.editor?.getSnapshot().session?.itemSession).toBe(true),
  );
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  const previous = f.session.editor?.getSnapshot().session;
  await userEvent.keyboard('{Control>}n{/Control}');
  await waitFor(() =>
    expect(f.session.editor?.getSnapshot().session).not.toBe(previous),
  );
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', {name: '곡 제목'}),
    ),
  );
  expect(
    screen.getByRole<HTMLInputElement>('textbox', {name: '곡 제목'}).readOnly,
  ).toBe(false);
});

it('starts a new blank item in slide 1 text, then reopens it on list commands', async () => {
  mockMenuRowHeight();
  const f = setup();
  await userEvent.click(screen.getByRole('button', {name: '항목 추가'}));
  await userEvent.click(screen.getByRole('menuitem', {name: '빈 슬라이드'}));
  const text = await screen.findByRole<HTMLTextAreaElement>('textbox', {
    name: '글',
  });
  expect(document.activeElement).toBe(text);
  expect(text.selectionStart).toBe(0);
  await userEvent.keyboard('New slide text');
  await waitFor(() =>
    expect(
      f
        .service()
        .service.order.some(
          item =>
            isItemOfKind(item, 'slides') &&
            item.slides.slides.some(
              slide => 'text' in slide && slide.text === 'New slide text',
            ),
        ),
    ).toBe(true),
  );
  const added = f.service().service.order.at(-1);
  if (added === undefined) throw new Error('Missing added item');
  await userEvent.keyboard('{Escape}');
  expect(document.activeElement).toBe(commandList());
  await userEvent.keyboard('{Escape}');
  await screen.findByRole('listbox', {name: '예배 순서'});
  await act(async () => {
    await f.api.slidesEditor.open({
      serviceId: fixtureServiceId,
      itemId: added.id,
    });
  });
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  expect(
    screen.getByRole<HTMLTextAreaElement>('textbox', {name: '글'}).value,
  ).toBe('New slide text');
});

it('serializes a palette double click followed by an immediate order drop', async () => {
  const fixture = setup();
  const original = fixture.api.content.edit;
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let first = true;
  const edit = vi
    .spyOn(fixture.api.content, 'edit')
    .mockImplementation(async request => {
      if (request.type === 'service.update' && first) {
        first = false;
        await gate;
      }
      return original(request);
    });
  const initialIds = new Set(
    fixture.service().service.order.map(item => item.id),
  );
  const before = initialIds.size;
  const row = screen.getByRole('option', {name: /Service song/});
  fireEvent.click(row);
  fireEvent.doubleClick(screen.getByRole('button', {name: '빈 슬라이드'}));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const dataTransfer = {
    types: [ELEMENT_DRAG_MIME],
    getData: (type: string) => (type === ELEMENT_DRAG_MIME ? 'standby' : ''),
    dropEffect: 'none',
  };
  const event = new MouseEvent('drop', {
    bubbles: true,
    cancelable: true,
    clientY: 999,
  });
  Object.defineProperty(event, 'dataTransfer', {value: dataTransfer});
  fireEvent(row, event);
  if (!release) throw new Error('Missing pending write');
  release();
  await waitFor(() =>
    expect(fixture.service().service.order).toHaveLength(before + 2),
  );
  const added = fixture
    .service()
    .service.order.filter(item => !initialIds.has(item.id));
  expect(added).toHaveLength(2);
  expect(
    added.map(item => (isItemOfKind(item, 'slides') ? item.slides.name : null)),
  ).toEqual(['예배 준비', '빈 슬라이드']);
  const calls = edit.mock.calls.map(([request]) => request);
  expect(
    calls.map(request =>
      request.type === 'service.update' ? request.baseRevision : null,
    ),
  ).toEqual([3, 4]);

  expect(edit).toHaveBeenCalledTimes(2);
});

it('queues a media drop behind an unfinished palette insertion', async () => {
  const fixture = setup();
  const original = fixture.api.content.edit;
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let first = true;
  const edit = vi
    .spyOn(fixture.api.content, 'edit')
    .mockImplementation(async request => {
      if (request.type === 'service.update' && first) {
        first = false;
        await gate;
      }
      return original(request);
    });
  const initialIds = new Set(
    fixture.service().service.order.map(item => item.id),
  );
  const row = screen.getByRole('option', {name: /Service song/});
  fireEvent.click(row);
  fireEvent.doubleClick(screen.getByRole('button', {name: '빈 슬라이드'}));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const dataTransfer = {
    types: [MEDIA_DRAG_MIME],
    getData: (type: string) =>
      type === MEDIA_DRAG_MIME ? fixtureMedia.warm : '',
    dropEffect: 'none',
  };
  const event = new MouseEvent('drop', {
    bubbles: true,
    cancelable: true,
    clientY: 1,
  });
  Object.defineProperty(event, 'dataTransfer', {value: dataTransfer});
  fireEvent(row, event);
  if (!release) throw new Error('Missing pending write');
  release();
  await waitFor(() =>
    expect(fixture.service().service.order).toHaveLength(initialIds.size + 2),
  );
  const added = fixture
    .service()
    .service.order.filter(item => !initialIds.has(item.id));
  expect(
    added.some(
      item => isItemOfKind(item, 'media') && item.media === fixtureMedia.warm,
    ),
  ).toBe(true);
  expect(
    added.some(
      item =>
        isItemOfKind(item, 'slides') && item.slides.name === '빈 슬라이드',
    ),
  ).toBe(true);
  expect(
    edit.mock.calls.map(([request]) =>
      request.type === 'service.update' ? request.baseRevision : null,
    ),
  ).toEqual([3, 4]);
});

it('uses item background writes for an order drop and records undo', async () => {
  const fixture = setup();
  const row = screen.getByRole('option', {name: /Service song/});
  vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 100, 200, 40),
  );
  const dataTransfer = {
    types: [MEDIA_DRAG_MIME],
    getData: (type: string) =>
      type === MEDIA_DRAG_MIME ? fixtureMedia.warm : '',
    dropEffect: 'none',
  };
  const event = new MouseEvent('drop', {
    bubbles: true,
    cancelable: true,
    clientY: 120,
  });
  Object.defineProperty(event, 'dataTransfer', {value: dataTransfer});
  fireEvent(row, event);
  await waitFor(() =>
    expect(
      fixture
        .service()
        .service.order.find(item => item.id === fixtureItems.arranged),
    ).toMatchObject({background: fixtureMedia.warm}),
  );
  await act(async () =>
    expect(
      (await serviceOrderEditsFor(fixture.api).undo(fixtureServiceId)).ok,
    ).toBe(true),
  );
  expect(
    fixture
      .service()
      .service.order.find(item => item.id === fixtureItems.arranged),
  ).not.toHaveProperty('background');
});

it.each(['double-click', 'Enter'] as const)(
  'selects and reveals a palette insertion made with %s',
  async path => {
    const fixture = setup();
    const initial = new Set(
      fixture.service().service.order.map(item => item.id),
    );
    const button = screen.getByRole('button', {name: '빈 슬라이드'});
    button.focus();
    if (path === 'double-click') fireEvent.doubleClick(button);
    else fireEvent.keyDown(button, {key: 'Enter', code: 'Enter'});
    await waitFor(() =>
      expect(
        fixture.service().service.order.some(item => !initial.has(item.id)),
      ).toBe(true),
    );
    const added = fixture
      .service()
      .service.order.find(item => !initial.has(item.id));
    if (!added) throw new Error('Missing inserted item');
    act(() =>
      useShow.setState(state => ({
        rows: [
          ...state.rows,
          {kind: 'slides', form: 'blank', id: added.id, title: '빈 슬라이드'},
        ],
      })),
    );
    await waitFor(() => expect(useShow.getState().openItemId).toBe(added.id));
    const row = await screen.findByRole('option', {name: /빈 슬라이드/});
    expect(row.getAttribute('aria-selected')).toBe('true');
    await waitFor(() =>
      expect(
        vi.mocked(HTMLElement.prototype.scrollIntoView).mock.instances,
      ).toContain(row.closest('[data-order-id]')),
    );
  },
);

it('undoes and redoes an insertion while the palette keeps focus', async () => {
  const fixture = setup();
  const before = fixture.service().service.order.length;
  const button = screen.getByRole('button', {name: '빈 슬라이드'});
  expect(button.closest('[data-panel="prep-palette"]')).not.toBeNull();
  button.focus();
  fireEvent.doubleClick(button);
  await waitFor(() =>
    expect(fixture.service().service.order).toHaveLength(before + 1),
  );
  expect(document.activeElement).toBe(button);
  fireEvent.keyDown(button, {key: 'z', code: 'KeyZ', ctrlKey: true});
  await waitFor(() =>
    expect(fixture.service().service.order).toHaveLength(before),
  );
  const tab = screen.getByRole('tab', {name: '예배 요소'});
  tab.focus();
  fireEvent.keyDown(tab, {key: 'y', code: 'KeyY', ctrlKey: true});
  await waitFor(() =>
    expect(fixture.service().service.order).toHaveLength(before + 1),
  );
});

it('queues palette undo issued while the insertion is saving', async () => {
  const fixture = setup();
  const original = fixture.api.content.edit;
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let first = true;
  const edit = vi
    .spyOn(fixture.api.content, 'edit')
    .mockImplementation(async request => {
      if (request.type === 'service.update' && first) {
        first = false;
        await gate;
      }
      return original(request);
    });
  const before = fixture.service().service.order.length;
  const button = screen.getByRole('button', {name: '빈 슬라이드'});
  button.focus();
  fireEvent.doubleClick(button);
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  fireEvent.keyDown(button, {key: 'z', code: 'KeyZ', ctrlKey: true});
  if (!release) throw new Error('Missing pending write');
  release();
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(fixture.service().service.order).toHaveLength(before),
  );
});

it('leaves undo in the library search field to native text editing', async () => {
  const fixture = setup();
  const before = fixture.service().service.order.length;
  const button = screen.getByRole('button', {name: '빈 슬라이드'});
  fireEvent.doubleClick(button);
  await waitFor(() =>
    expect(fixture.service().service.order).toHaveLength(before + 1),
  );
  fireEvent.click(screen.getByRole('tab', {name: '곡'}));
  const search = screen.getByRole('textbox', {name: '라이브러리 검색'});
  search.focus();
  fireEvent.keyDown(search, {key: 'z', code: 'KeyZ', ctrlKey: true});
  await act(async () => {
    await Promise.resolve();
  });
  expect(fixture.service().service.order).toHaveLength(before + 1);
});
