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
import {mockMenuRowHeight} from '@fixtures/renderer/features/songs/editor/editorTesting';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));
vi.mock('@renderer/rendering/SlidePicture', () => ({SlidePicture: () => null}));

const sessions: ControlSession[] = [];

function setup() {
  const f = itemFixture();
  const slides = newSlidesItem('blank', fixtureItems.lost);
  f.pushService({
    ...f.service(),
    service: {
      ...f.service().service,
      order: [
        ...f.service().service.order.filter(item => item.id !== slides.id),
        slides,
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
    ],
    tiles: {
      [fixtureItems.arranged]: f.first.song.slides.map(slide => ({
        labelColor: 'none' as const,
        lines: slide.lines,
        label: slide.label ?? null,
        sourceSlide: {songId: f.first.song.id, slideId: slide.id},
      })),
      [slides.id]: [{lines: [], label: null, labelColor: 'none'}],
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

it.each(['double-click', 'Enter', 'edit button'] as const)(
  'focuses a service song opened by %s and restores its table row after Escape',
  async path => {
    const f = setup();
    const table = screen.getByRole('listbox', {name: '예배 순서'});
    const row = within(table).getByRole('option', {name: /Service song/});
    await userEvent.click(row);
    if (path === 'double-click') await userEvent.dblClick(row);
    else if (path === 'Enter') await userEvent.keyboard('{Enter}');
    else {
      await userEvent.click(
        await screen.findByRole('button', {name: '곡 편집'}),
      );
    }
    await waitFor(() => expect(document.activeElement).toBe(commandList()));
    const model = f.session.editor?.getSnapshot().session?.slideModel;
    expect(model?.getSnapshot().selection.ids.size).toBe(1);
    await userEvent.keyboard('{Control>}d{/Control}');
    expect(model?.getSnapshot().slides).toHaveLength(3);
    await userEvent.keyboard('{Escape}');
    expect(model?.getSnapshot().selection.ids.size).toBe(0);
    expect(screen.queryByRole('listbox', {name: '예배 순서'})).toBeNull();
    await userEvent.keyboard('{Escape}');
    const returned = await screen.findByRole('listbox', {name: '예배 순서'});
    expect(document.activeElement).toBe(
      within(returned).getByRole('option', {name: /Service song/}),
    );
  },
);

it.each(['double-click', 'Enter', 'edit button'] as const)(
  'focuses sermon list commands opened by %s and handles body Escape',
  async path => {
    setup();
    const row = screen.getByRole('option', {name: /Sermon item/});
    await userEvent.click(row);
    if (path === 'double-click') await userEvent.dblClick(row);
    else if (path === 'Enter') await userEvent.keyboard('{Enter}');
    else {
      await userEvent.click(
        await screen.findByRole('button', {name: '슬라이드 편집…'}),
      );
    }
    await waitFor(() => expect(document.activeElement).toBe(commandList()));
    await userEvent.keyboard('{Escape}');
    act(() =>
      document.activeElement instanceof HTMLElement
        ? document.activeElement.blur()
        : undefined,
    );
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document.body, {key: 'Escape', code: 'Escape'});
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
    await userEvent.keyboard('{Escape}');
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
  const grid = await screen.findByRole('group', {name: '슬라이드 편집 명령'});
  const slide = grid.querySelector<HTMLElement>(
    '[data-slide-index="1"] [role="option"]',
  );
  if (slide === null) throw new Error('Missing second grid slide');
  await userEvent.dblClick(slide);
  await waitFor(() => expect(document.activeElement).toBe(commandList()));
  const model = f.session.editor
    ?.getSnapshot()
    .session?.slideModel.getSnapshot();
  expect([...(model?.selection.ids ?? [])]).toEqual([
    f.first.song.slides[1]?.id,
  ]);
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
  await userEvent.keyboard('{Escape}{Escape}');
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
