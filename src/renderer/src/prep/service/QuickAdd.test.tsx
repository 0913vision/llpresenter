import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {LibrarySearchRequest} from '@shared/schema/librarySearch';
import {mockMenuRowHeight} from '@renderer/prep/editor/editorTesting';
import {useShow} from '@renderer/state/show';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {NEWER_FILE_REASON} from './ItemArrangement';
import {fixtureItems, fixtureServiceId, itemFixture} from './itemFixture';
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
  const api = {...fixture.api, library: {...fixture.api.library, search}};
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
    await waitFor(() =>
      expect(within(menu).getAllByRole('menuitem')).toHaveLength(2),
    );
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

  it('is unavailable for a read-only service, with the reason', async () => {
    setup();
    act(() => useShow.setState({readOnly: true}));
    const add = screen.getByRole('button', {name: '항목 추가'});
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect((await hoverForTooltip(add))?.textContent).toBe(NEWER_FILE_REASON);
  });
});
