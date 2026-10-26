import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import type {SongDocument} from '@shared/schema/contentDocuments';
import {editorFixture} from '@renderer/prep/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {sampleService} from '@renderer/show/testing/sampleService';
import {useLive} from '@renderer/state/live';
import {applyService, useShow} from '@renderer/state/show';
import {App} from './App';
import {ControlSession} from './controlSession';

vi.mock('@renderer/render/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const sessions: ControlSession[] = [];
async function chooseToolbarResult(): Promise<void> {
  const list = await screen.findByRole('listbox', {name: '곡 검색 결과'});
  await userEvent.click(
    await within(list).findByRole('option', {name: /새 노래 1/}),
  );
}
async function setup() {
  const fixture = editorFixture();
  const {api, first} = fixture;
  vi.spyOn(api.library, 'search').mockImplementation(async ({query}) => ({
    query,
    matches:
      query === '숨김'
        ? []
        : [
            {
              songId: first.song.id,
              title: first.song.title,
              slideCount: 2,
              match: {kind: 'title'},
            },
          ],
  }));
  const showSong = vi.spyOn(api.library, 'showSong');
  const send = vi.spyOn(api.live, 'send');
  const edit = vi.spyOn(api.content, 'edit');
  window.llp = api;
  const session = new ControlSession(api);
  sessions.push(session);
  render(
    <App session={session} columnWidthStore={createMemoryColumnWidthStore()} />,
  );
  await userEvent.click(screen.getByRole('tab', {name: '준비'}));
  await screen.findByRole('option', {name: first.song.title});
  return {...fixture, session, showSong, send, edit};
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('innerWidth', 1920);
  vi.stubGlobal('innerHeight', 899);
  useShow.setState({librarySong: null});
  applyService(null);
  applyService(sampleService);
  useLive.setState({state: emptyLiveState()});
});

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  useShow.setState({librarySong: null});
  applyService(null);
  delete window.llp;
});

it('selects a prep toolbar result in the library and opens the editor without service edits or output', async () => {
  const {first, send, edit, showSong} = await setup();
  const rows = useShow.getState().rows;
  const libraryQuery = screen.getByRole('textbox', {name: '라이브러리 검색'});
  await userEvent.type(libraryQuery, '숨김');
  await waitFor(() =>
    expect(screen.queryByRole('option', {name: first.song.title})).toBeNull(),
  );
  await userEvent.type(screen.getByRole('combobox', {name: '검색'}), '새');
  await chooseToolbarResult();
  await waitFor(() =>
    expect(screen.getByRole('textbox', {name: '곡 제목'})).toHaveProperty(
      'value',
      first.song.title,
    ),
  );
  expect(libraryQuery).toHaveProperty('value', '');
  expect(
    screen
      .getByRole('option', {name: first.song.title})
      .getAttribute('aria-selected'),
  ).toBe('true');
  expect(useShow.getState().rows).toBe(rows);
  expect(edit).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
  expect(showSong).not.toHaveBeenCalled();
});

it('does not replay a consumed request after a workspace switch', async () => {
  const {first, second} = await setup();
  await userEvent.type(screen.getByRole('combobox', {name: '검색'}), '새');
  await chooseToolbarResult();
  await screen.findByRole('textbox', {name: '곡 제목'});
  await userEvent.click(screen.getByRole('option', {name: second.song.title}));
  await waitFor(() =>
    expect(screen.getByRole('textbox', {name: '곡 제목'})).toHaveProperty(
      'value',
      second.song.title,
    ),
  );
  await userEvent.click(screen.getByRole('tab', {name: '진행'}));
  await userEvent.click(screen.getByRole('tab', {name: '준비'}));
  await waitFor(() =>
    expect(screen.getByRole('textbox', {name: '곡 제목'})).toHaveProperty(
      'value',
      second.song.title,
    ),
  );
  expect(screen.getByRole('textbox', {name: '곡 제목'})).not.toHaveProperty(
    'value',
    first.song.title,
  );
});

it('cancels a pending library open when a service item is selected', async () => {
  const {api, first, send} = await setup();
  let finish: (document: SongDocument | null) => void = () => undefined;
  const get = vi.spyOn(api.songs, 'get').mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await userEvent.type(screen.getByRole('combobox', {name: '검색'}), '새');
  await chooseToolbarResult();
  await waitFor(() => expect(get).toHaveBeenCalledWith(first.song.id));
  await userEvent.click(screen.getByRole('option', {name: '아침이 밝아 오네'}));
  await act(async () => {
    finish(first);
  });
  expect(screen.queryByRole('textbox', {name: '곡 제목'})).toBeNull();
  expect(
    screen
      .getByRole('option', {name: first.song.title})
      .getAttribute('aria-selected'),
  ).toBe('false');
  expect(send).not.toHaveBeenCalled();
});
