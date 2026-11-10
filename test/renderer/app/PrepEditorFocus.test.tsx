import {StrictMode} from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {createServiceItemId, createThemeId} from '@core/schema/ids';
import type {SongEditorTarget} from '@core/schema/ipcPayloads';
import type {SlidesEditorTarget} from '@contracts/ipc/slidesEditor';
import {newSlidesItem} from '@core/services/slidesEdits';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {App} from '@renderer/app/App';
import {ControlSession} from '@renderer/app/controlSession';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {applyService} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {isItemOfKind} from '@core/schema/service';
import {otherItems, templateOrder} from '@fixtures/core/serviceList';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {mockMenuRowHeight} from '@fixtures/renderer/features/songs/editor/editorTesting';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));
vi.mock('@renderer/rendering/SlidePicture', () => ({SlidePicture: () => null}));

const sessions: ControlSession[] = [];

function setup(extraSlides = false, songCard = false) {
  const f = itemFixture();
  const slides = newSlidesItem('blank', fixtureItems.lost);
  const announcement = newSlidesItem(
    'ad',
    createServiceItemId('50000000-0000-4000-8000-000000000097'),
  );
  const section = {
    ...newSlidesItem(
      'blank',
      createServiceItemId('50000000-0000-4000-8000-000000000098'),
    ),
    sectionCard: {
      name: 'Section',
      english: 'Section',
      theme: createThemeId('00000000-0000-4000-8000-000000000111'),
    },
  };
  const sourceBible = templateOrder.find(item => isItemOfKind(item, 'bible'));
  if (!sourceBible) throw new Error('Missing Bible fixture');
  const media = otherItems[0];
  if (!media || !isItemOfKind(media, 'media')) {
    throw new Error('Missing media fixture');
  }
  const bible = {
    ...sourceBible,
    id: createServiceItemId('50000000-0000-4000-8000-000000000099'),
  };
  f.pushService({
    ...f.service(),
    service: {
      ...f.service().service,
      order: [
        ...f
          .service()
          .service.order.filter(item => item.id !== slides.id)
          .map(item =>
            songCard &&
            item.id === fixtureItems.arranged &&
            isItemOfKind(item, 'song')
              ? {
                  ...item,
                  sectionCard: {
                    name: 'Song section',
                    english: 'Section',
                    theme: createThemeId(
                      '00000000-0000-4000-8000-000000000111',
                    ),
                  },
                }
              : item,
          ),
        slides,
        bible,
        media,
        ...(extraSlides ? [announcement, section] : []),
      ],
    },
  });
  const songs = new Set<(target: SongEditorTarget | null) => void>();
  const items = new Set<(target: SlidesEditorTarget | null) => void>();
  vi.spyOn(f.api.songEditorWindow, 'onRetarget').mockImplementation(
    listener => {
      songs.add(listener);
      return () => {
        songs.delete(listener);
      };
    },
  );
  vi.spyOn(f.api.slidesEditor, 'onRetarget').mockImplementation(listener => {
    items.add(listener);
    return () => {
      items.delete(listener);
    };
  });
  vi.spyOn(f.api.window, 'openSongEditor').mockImplementation(async target => {
    for (const listener of songs) listener(target);
    return {ok: true, value: undefined};
  });
  vi.spyOn(f.api.slidesEditor, 'open').mockImplementation(async target => {
    for (const listener of items) listener(target);
    return {ok: true, value: undefined};
  });
  applyService({
    revision: 1,
    id: fixtureServiceId,
    name: 'Service',
    readOnly: false,
    rows: [
      {kind: 'song', id: fixtureItems.arranged, title: 'Service song'},
      {kind: 'slides', form: 'blank', id: slides.id, title: 'Sermon item'},
      {kind: 'bible', id: bible.id, title: 'Bible item'},
      {kind: 'media', id: media.id, title: 'Media item'},
      ...(extraSlides
        ? [
            {
              kind: 'slides' as const,
              form: 'ad' as const,
              id: announcement.id,
              title: 'Announcement item',
            },
            {
              kind: 'slides' as const,
              form: 'blank' as const,
              id: section.id,
              title: 'Section item',
            },
          ]
        : []),
    ],
    tiles: {
      [fixtureItems.arranged]: f.first.song.slides.map(slide => ({
        labelColor: 'none' as const,
        lines: slide.lines,
        label: slide.label ?? null,
        sourceSlide: {songId: f.first.song.id, slideId: slide.id},
      })),
      [slides.id]: [{lines: [], label: null, labelColor: 'none'}],
      [bible.id]: [{lines: [], label: null, labelColor: 'none'}],
      ...(extraSlides
        ? {
            [announcement.id]: [
              {lines: [], label: null, labelColor: 'none' as const},
            ],
            [section.id]: [
              {lines: [], label: null, labelColor: 'none' as const},
            ],
          }
        : {}),
    },
    jumpKeys: {},
  });
  window.llp = f.api;
  const session = new ControlSession(f.api);
  sessions.push(session);
  render(
    <StrictMode>
      <App
        session={session}
        columnWidthStore={createMemoryColumnWidthStore()}
      />
    </StrictMode>,
  );
  fireEvent.click(screen.getByRole('tab', {name: '준비'}));
  return {...f, session};
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(async () => {
  cleanup();
  resetTooltips();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  applyService(null);
  useLive.setState({state: null});
  delete window.llp;
  vi.restoreAllMocks();
});

function commandList(): HTMLElement {
  const editor =
    screen.queryByRole('region', {name: '곡 편집'}) ??
    screen.getByLabelText('슬라이드 편집', {selector: 'div'});
  return within(editor).getByRole('group', {name: '슬라이드 편집 명령'});
}

it.each(['double-click', 'Enter'] as const)(
  'focuses a service song opened by %s and restores its table row after Escape',
  async path => {
    const f = setup();
    const table = screen.getByRole('listbox', {name: '예배 순서'});
    const row = within(table).getByRole('option', {name: /Service song/});
    await userEvent.click(row);
    if (path === 'double-click') await userEvent.dblClick(row);
    else await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(document.activeElement).toBe(commandList()));
    const model = f.session.editor?.getSnapshot().session?.slideModel;
    expect(model?.getSnapshot().selection.ids.size).toBe(1);
    await userEvent.keyboard('{Control>}d{/Control}');
    expect(model?.getSnapshot().slides).toHaveLength(3);
    await userEvent.keyboard('{Escape}');
    const returned = await screen.findByRole('listbox', {name: '예배 순서'});
    expect(document.activeElement).toBe(
      within(returned).getByRole('option', {name: /Service song/}),
    );
  },
);

it.each([
  ['Bible item', 'double-click'],
  ['Bible item', 'Enter'],
  ['Media item', 'double-click'],
  ['Media item', 'Enter'],
] as const)(
  'opens %s with %s and returns to its focused row on Escape',
  async (name, path) => {
    setup();
    const row = screen.getByRole('option', {name});
    await userEvent.click(row);
    expect(screen.queryByRole('button', {name: '‹ Service'})).toBeNull();
    if (path === 'double-click') await userEvent.dblClick(row);
    else await userEvent.keyboard('{Enter}');
    const back = await screen.findByRole('button', {name: '‹ Service'});
    expect(back.closest('[data-panel="편집"]')).not.toBeNull();
    back.focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('button', {name: '‹ Service'})).toBeNull(),
    );
    expect(document.activeElement).toBe(screen.getByRole('option', {name}));
  },
);

it.each(['Bible item', 'Media item'] as const)(
  'opens the %s editor and inspector from a details slide',
  async name => {
    const f = setup();
    const send = vi.spyOn(f.api.live, 'send');
    await userEvent.click(screen.getByRole('option', {name}));
    const details = screen.getByRole('region', {name: '세부정보'});
    await userEvent.click(within(details).getByRole('tab', {name: '슬라이드'}));
    const grid = within(details).getByRole('listbox', {name: '슬라이드'});
    const first = await within(grid).findByRole('option', {name: /^1(?:\s|$)/});
    await userEvent.dblClick(first);
    await screen.findByRole('button', {name: '‹ Service'});
    expect(screen.getByRole('region', {name: '슬라이드 속성'})).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  },
);

it.each([
  ['Announcement item', 'double-click'],
  ['Announcement item', 'Enter'],
  ['Section item', 'double-click'],
  ['Section item', 'Enter'],
] as const)('opens %s with %s in the slide editor', async (name, path) => {
  setup(true);
  const row = screen.getByRole('option', {name});
  await userEvent.click(row);
  if (path === 'double-click') await userEvent.dblClick(row);
  else await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  await userEvent.keyboard('{Escape}');
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('option', {name})),
  );
});

it('retains the section card when the details panel unmounts for the editor', async () => {
  setup(true);
  const row = screen.getByRole('option', {name: 'Section item'});
  await userEvent.click(row);
  await userEvent.dblClick(row);
  const card = await screen.findByRole('textbox', {name: '구역 이름'});
  expect(card).toHaveProperty('value', 'Section');
  await waitFor(() =>
    expect(document.querySelector('[data-leading-card]')).not.toBeNull(),
  );
});

it('binds a service song card while switching from details to the editor', async () => {
  setup(false, true);
  await userEvent.dblClick(screen.getByRole('option', {name: /Service song/}));
  const field = await screen.findByRole('textbox', {name: '구역 이름'});
  expect(field).toHaveProperty('value', 'Song section');
  expect(document.querySelector('[data-leading-card]')).not.toBeNull();
});

it('switches from a song to a Bible item and back to a song', async () => {
  setup();
  await userEvent.dblClick(screen.getByRole('option', {name: /Service song/}));
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  await userEvent.click(screen.getByRole('option', {name: 'Bible item'}));
  await screen.findByRole('button', {name: '‹ Service'});
  await userEvent.click(screen.getByRole('option', {name: /Service song/}));
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
});

it('tabs from the numbered navigator through the editor before the right panel', async () => {
  setup();
  await userEvent.dblClick(screen.getByRole('option', {name: /Service song/}));
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  const navigator = screen.getByRole('listbox', {name: '예배 순서'});
  const row = within(navigator).getByRole('option', {name: /Service song/});
  expect(row.textContent).toContain('1');
  expect(row.textContent).toContain('Service song');
  expect(row.textContent).not.toContain('슬라이드');
  expect(
    within(navigator).getByRole('option', {name: 'Bible item'}).textContent,
  ).not.toContain('슬라이드');
  row.focus();
  let sawEditor = false;
  let sawRight = false;
  for (let i = 0; i < 60 && !sawRight; i++) {
    await userEvent.tab();
    const active = document.activeElement;
    if (!(active instanceof Element)) continue;
    if (active.closest('[data-panel="편집"]')) sawEditor = true;
    if (active.closest('[data-panel="슬라이드 속성"]')) {
      expect(sawEditor).toBe(true);
      sawRight = true;
    }
  }
  expect(sawRight).toBe(true);
  await userEvent.keyboard('{Escape}');
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('option', {name: /Service song/}),
    ),
  );
});

it('shows the full navigator name in a tooltip when it is truncated', async () => {
  setup();
  await userEvent.dblClick(screen.getByRole('option', {name: /Service song/}));
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  const row = within(
    screen.getByRole('listbox', {name: '예배 순서'}),
  ).getByRole('option', {name: /Service song/});
  const name = within(row).getByText('Service song');
  Object.defineProperties(name, {
    clientWidth: {value: 40},
    scrollWidth: {value: 120},
  });
  expect((await hoverForTooltip(name))?.textContent).toBe('Service song');
});

it.each(['double-click', 'Enter'] as const)(
  'focuses sermon list commands opened by %s and handles body Escape',
  async path => {
    setup();
    const row = screen.getByRole('option', {name: /Sermon item/});
    await userEvent.click(row);
    if (path === 'double-click') await userEvent.dblClick(row);
    else await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(document.activeElement).toBe(commandList()));
    fireEvent.keyDown(document.body, {key: 'Escape', code: 'Escape'});
    await waitFor(() =>
      expect(
        screen.queryByLabelText('슬라이드 편집', {selector: 'div'}),
      ).toBeNull(),
    );
    const table = await screen.findByRole('listbox', {name: '예배 순서'});
    expect(document.activeElement).toBe(
      within(table).getByRole('option', {name: /Sermon item/}),
    );
  },
);

it.each(['double-click', 'Enter'] as const)(
  'focuses library commands opened by %s and returns to its row',
  async path => {
    const f = setup();
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

it('selects the source slide and focuses commands after opening from the right grid', async () => {
  const f = setup();
  await userEvent.click(screen.getByRole('option', {name: /Service song/}));
  const details = await screen.findByRole('region', {name: '세부정보'});
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
  vi.spyOn(f.api.library, 'showSong').mockResolvedValue({
    songId: f.first.song.id,
    songRevision: f.first.revision,
    title: f.first.song.title,
    readOnly: false,
    tiles: f.first.song.slides.map(slide => ({
      label: slide.label ?? null,
      labelColor: 'none' as const,
      lines: slide.lines,
    })),
    jumpKeys: {},
  });
  const live = vi.spyOn(f.api.live, 'send');
  const library = screen.getByRole('listbox', {name: '라이브러리 곡'});
  await userEvent.click(
    await within(library).findByRole('option', {name: f.first.song.title}),
  );
  const details = screen.getByRole('region', {name: '세부정보'});
  await within(details).findByText(
    `곡, 슬라이드 ${f.first.song.slides.length}개`,
  );
  expect(within(details).queryByRole('group', {name: '이번 예배'})).toBeNull();
  expect(f.api.window.openSongEditor).not.toHaveBeenCalled();
  expect(live).not.toHaveBeenCalled();
});

it('keeps Ctrl N in the title and enters the first slide text with Enter', async () => {
  setup();
  await userEvent.keyboard('{Control>}n{/Control}');
  const title = await screen.findByRole('textbox', {name: '곡 제목'});
  expect(document.activeElement).toBe(title);
  await userEvent.keyboard('{Enter}');
  expect(document.activeElement).toBe(
    screen.getByRole('textbox', {name: '슬라이드 1 가사'}),
  );
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
