import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createMediaId} from '@shared/schema/ids';
import type {LibrarySearchRequest} from '@shared/schema/librarySearch';
import {parseMediaDocument} from '@shared/schema/mediaEdit';
import {mockMenuRowHeight} from '@renderer/prep/editor/editorTesting';
import {useShow} from '@renderer/state/show';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {NEWER_FILE_REASON} from './ItemArrangement';
import {fixtureItems, fixtureServiceId, itemFixture} from './itemFixture';
import {useHeaderRename} from '@renderer/state/headerRename';
import {ServiceQuickAdd} from './QuickAdd';

afterEach(() => {
  useShow.setState({
    serviceId: null,
    readOnly: false,
    rows: [],
    openItemId: null,
  });
  delete window.llp;
  resetTooltips();
});

const dawn = createMediaId('60000000-0000-4000-8000-000000000012');

function mediaDocument() {
  const parsed = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      playlists: [],
      audioPlaylists: [],
      items: [
        {id: dawn, name: '새벽 하늘', kind: 'video', file: 'b.mp4', size: 0},
      ],
    },
  });
  if (!parsed.ok) throw new Error('Invalid media fixture');
  return parsed.value;
}

function songItems(menu: HTMLElement): HTMLElement[] {
  return within(menu).queryAllByRole('menuitem', {name: /새 노래/u});
}

function setup() {
  mockMenuRowHeight();
  Element.prototype.scrollIntoView = vi.fn();
  const fixture = itemFixture();
  const search = vi.fn(async ({query}: LibrarySearchRequest) => ({
    query,
    matches: [fixture.first, fixture.second]
      .filter(({song}) => song.title.includes(query))
      .map(({song}) => ({
        songId: song.id,
        title: song.title,
        slideCount: song.slides.length,
        match: {kind: 'title' as const},
      })),
  }));
  const api = {
    ...fixture.api,
    library: {...fixture.api.library, search},
    media: {...fixture.api.media, get: () => Promise.resolve(mediaDocument())},
  };
  window.llp = api;
  useShow.setState({
    serviceId: fixtureServiceId,
    readOnly: false,
    rows: [{kind: 'header', id: fixtureItems.header, title: '찬양'}],
    openItemId: null,
  });
  const onProblem = vi.fn();
  render(<ServiceQuickAdd onProblem={onProblem} />);
  return {...fixture, search, onProblem, user: userEvent.setup()};
}

describe('항목 추가', () => {
  it('searches the 라이브러리 and inserts the chosen song at the end', async () => {
    const {user, search, service, second} = setup();
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    const menu = screen.getByRole('menu', {name: '항목 추가'});
    expect(
      screen.getByRole('combobox', {name: '곡, 가사, 초성'}),
    ).toBeDefined();
    await waitFor(() => expect(songItems(menu)).toHaveLength(2));
    await user.keyboard('노래 2');
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith({query: '노래 2', limit: 20}),
    );
    const song = await within(menu).findByRole('menuitem', {
      name: /새 노래 2/u,
    });
    expect(within(song).getByText('노래 2').tagName).toBe('SPAN');
    expect(song.textContent).toContain('슬라이드 2개');
    await user.click(song);
    await waitFor(() => expect(service().service.order).toHaveLength(6));
    expect(service().service.order.at(-1)).toMatchObject({
      song: second.song.id,
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('points to the first result again when the query changes', async () => {
    const {user, service, first} = setup();
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    const menu = screen.getByRole('menu', {name: '항목 추가'});
    await waitFor(() => expect(songItems(menu)).toHaveLength(2));
    await user.keyboard('{ArrowDown}');
    const field = screen.getByRole('combobox', {name: '곡, 가사, 초성'});
    expect(field.getAttribute('aria-activedescendant')).toBe(
      songItems(menu)[1]?.id,
    );
    await user.keyboard('노래');
    await waitFor(() => expect(songItems(menu)).toHaveLength(2));
    await waitFor(() =>
      expect(field.getAttribute('aria-activedescendant')).toBe(
        songItems(menu)[0]?.id,
      ),
    );
    await user.keyboard('{Enter}');
    await waitFor(() => expect(service().service.order).toHaveLength(6));
    expect(service().service.order.at(-1)).toMatchObject({
      song: first.song.id,
    });
  });

  it('points to the first result that arrives after keys pressed on an empty list', async () => {
    const {search, user, service, first} = setup();
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    const menu = screen.getByRole('menu', {name: '항목 추가'});
    await waitFor(() => expect(songItems(menu)).toHaveLength(2));
    const real = search.getMockImplementation();
    if (real === undefined) throw new Error('No search implementation');
    let release: () => void = () => undefined;
    search.mockImplementation(
      request =>
        new Promise(resolve => {
          release = () => resolve(real(request));
        }),
    );
    await user.keyboard('노래');
    await waitFor(() => expect(songItems(menu)).toHaveLength(0));
    await user.keyboard('{ArrowDown}{ArrowDown}');
    release();
    const field = screen.getByRole('combobox', {name: '곡, 가사, 초성'});
    await waitFor(() =>
      expect(field.getAttribute('aria-activedescendant')).toBe(
        songItems(menu)[0]?.id,
      ),
    );
    await user.keyboard('{Enter}');
    await waitFor(() => expect(service().service.order).toHaveLength(6));
    expect(service().service.order.at(-1)).toMatchObject({song: first.song.id});
  });

  it('inserts 머리글 and asks the list to rename it', async () => {
    const {user, service} = setup();
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    await user.click(screen.getByRole('menuitem', {name: '머리글'}));
    await waitFor(() => expect(service().service.order).toHaveLength(6));
    const added = service().service.order.at(-1);
    expect(added).toMatchObject({header: '머리글'});
    expect(useHeaderRename.getState().requested).toBe(added?.id);
  });

  it('inserts a 빈 자리 and a media item from the submenus', async () => {
    const {user, service} = setup();
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    await user.click(screen.getByRole('menuitem', {name: '빈 자리'}));
    await user.click(screen.getByRole('menuitem', {name: '설교'}));
    await waitFor(() => expect(service().service.order).toHaveLength(6));
    expect(service().service.order.at(-1)).toMatchObject({
      slot: 'slides',
      title: '설교',
    });
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    await user.click(screen.getByRole('menuitem', {name: '미디어'}));
    await user.click(await screen.findByRole('menuitem', {name: '새벽 하늘'}));
    await waitFor(() => expect(service().service.order).toHaveLength(7));
    expect(service().service.order.at(-1)).toMatchObject({
      media: dawn,
    });
  });

  it('is unavailable for a read-only service, with the reason', async () => {
    setup();
    act(() => useShow.setState({readOnly: true}));
    const add = screen.getByRole('button', {name: '항목 추가'});
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect((await hoverForTooltip(add))?.textContent).toBe(NEWER_FILE_REASON);
  });
});
