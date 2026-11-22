import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {
  closeSongDraft,
  editSong,
  openImportedSong,
  openNewSong,
  openSongDraft,
  renameDraftLabel,
  replaySong,
  requestLeaveSong,
  startSongDraftSync,
  useSongDraft,
} from '@renderer/features/songs/songDraft';
import {SongDraftDialogs} from '@renderer/features/songs/SongDraftDialogs';
import {useSongEditor} from '@renderer/features/songs/SongEditor';
import {useThemes} from '@renderer/platform/themes';
import {themes, themeScreens} from '@fixtures/core/themeOutput';
import {
  editorFixture,
  editorSong,
} from '@fixtures/renderer/features/songs/editorFixture';

let stop = (): void => undefined;
const back = vi.fn();
const report = vi.fn();

function Harness(): JSX.Element {
  const editor = useSongEditor({report, onBack: back});
  return (
    <>
      {editor?.editor}
      {editor?.inspector}
      <SongDraftDialogs />
    </>
  );
}

async function setup() {
  const fixture = editorFixture();
  window.llp = fixture.api;
  stop = startSongDraftSync(fixture.api, report);
  await waitFor(() =>
    expect(useSongDraft.getState().libraryStatus).toBe('ready'),
  );
  render(<Harness />);
  return fixture;
}

const draft = () => {
  const {draft: open} = useSongDraft.getState();
  if (open === null) throw new Error('No song is open');
  return open;
};
const title = () =>
  screen.getByRole<HTMLInputElement>('textbox', {name: '곡 제목'});
const texts = () =>
  draft().song.slides.map(slide => Object.values(slide.texts).join('/'));
const cutShort = () =>
  editSong(song => ({...song, slides: song.slides.slice(0, 1)}));

beforeEach(() => {
  useThemes.setState({themes: themes(), screens: themeScreens});
});
afterEach(() => {
  act(closeSongDraft);
  stop();
  back.mockReset();
  report.mockReset();
  delete window.llp;
});

it('starts a new song with its title and an empty slide of lyrics', async () => {
  await setup();
  act(openNewSong);
  expect(draft().song.slides.map(slide => slide.theme)).toEqual([
    BUILT_IN_THEME_IDS.songTitle,
    BUILT_IN_THEME_IDS.lyrics,
  ]);
  expect(document.activeElement).toBe(title());
});

it('renames the title slide with the song', async () => {
  await setup();
  act(openNewSong);
  fireEvent.change(title(), {target: {value: '아침 노래'}});
  expect(draft().song.slides[0]?.texts['제목']).toBe('아침 노래');
  act(() => replaySong('undo'));
  expect(draft().song.title).toBe('새 곡');
  act(() => replaySong('redo'));
  expect(draft().song.title).toBe('아침 노래');
});

it('saves an edited song over its file only after asking', async () => {
  const fixture = await setup();
  act(() => openSongDraft(editorSong(1)));
  const save = screen.getByRole('button', {name: '저장'});
  expect(save.getAttribute('aria-disabled')).toBe('true');
  act(cutShort);
  expect(screen.getByRole('img', {name: '저장하지 않은 변경'})).toBeTruthy();
  await userEvent.click(save);
  expect(fixture.edits).toEqual([]);
  await userEvent.click(screen.getByRole('button', {name: '덮어쓰기'}));
  await waitFor(() => expect(fixture.edits).toHaveLength(1));
  expect(fixture.edits[0]).toMatchObject({type: 'song.update'});
  await waitFor(() =>
    expect(screen.queryByRole('img', {name: '저장하지 않은 변경'})).toBeNull(),
  );
});

it.each(['', '새 노래 2'])('refuses the title %j and says why', async name => {
  await setup();
  act(() => openSongDraft(editorSong(1)));
  fireEvent.change(title(), {target: {value: name}});
  expect(title().getAttribute('aria-invalid')).toBe('true');
  expect(
    screen.getByRole('button', {name: '저장'}).getAttribute('aria-disabled'),
  ).toBe('true');
});

it('saves the song as another one and goes on with that', async () => {
  const fixture = await setup();
  act(() => openSongDraft(editorSong(1)));
  await userEvent.click(
    screen.getByRole('button', {name: '다른 이름으로 저장…'}),
  );
  const name = screen.getAllByRole('textbox', {name: '곡 제목'}).at(-1);
  if (name === undefined) throw new Error('Missing name');
  fireEvent.change(name, {target: {value: '다른 노래'}});
  fireEvent.keyDown(name, {key: 'Enter'});
  await waitFor(() => expect(draft().song.title).toBe('다른 노래'));
  expect(draft().song.id).not.toBe(editorSong(1).song.id);
  expect(fixture.edits[0]).toMatchObject({type: 'song.saveAs'});
});

it('leaves an unchanged song at once, and asks about changes', async () => {
  await setup();
  const proceed = vi.fn();
  act(() => openSongDraft(editorSong(1)));
  act(() => requestLeaveSong(proceed));
  expect(proceed).toHaveBeenCalledOnce();
  act(() => openSongDraft(editorSong(1)));
  act(cutShort);
  act(() => requestLeaveSong(proceed));
  expect(proceed).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', {name: '취소'}));
  expect(texts()).toHaveLength(1);
  act(() => requestLeaveSong(proceed));
  await userEvent.click(screen.getByRole('button', {name: '저장 안 함'}));
  expect(proceed).toHaveBeenCalledTimes(2);
  expect(useSongDraft.getState().draft).toBeNull();
});

it('leaves an untouched new song at once', async () => {
  await setup();
  const proceed = vi.fn();
  act(openNewSong);
  act(() => requestLeaveSong(proceed));
  expect(proceed).toHaveBeenCalledOnce();
});

it('asks before an imported song is left, although nothing was changed', async () => {
  await setup();
  const proceed = vi.fn();
  act(() => {
    openImportedSong({
      title: '가져온 노래',
      slides: [{lines: ['첫 줄'], section: 0}],
    });
  });
  expect(texts()).toEqual(['가져온 노래', '첫 줄']);
  act(() => requestLeaveSong(proceed));
  expect(proceed).not.toHaveBeenCalled();
  expect(screen.getByRole('alertdialog')).toBeTruthy();
});

it('follows a renamed label, and the file while nothing was changed', async () => {
  const fixture = await setup();
  act(() => openSongDraft(editorSong(1)));
  act(() => renameDraftLabel('후렴', '코러스'));
  expect(draft().song.slides[1]?.label).toBe('코러스');
  const other = editorSong(2);
  act(() => openSongDraft(other));
  act(() =>
    fixture.pushSong({
      ...other,
      revision: 5,
      song: {...other.song, title: '바뀐 제목'},
    }),
  );
  expect(draft().song.title).toBe('바뀐 제목');
});

it('changes nothing in a song of a newer version', async () => {
  await setup();
  const song = editorSong(1, 'readOnly');
  act(() => openSongDraft(song));
  act(cutShort);
  expect(draft().song).toEqual(song.song);
  expect(title().readOnly).toBe(true);
});

it('goes back with its button', async () => {
  await setup();
  act(() => openSongDraft(editorSong(1)));
  await userEvent.click(screen.getByRole('button', {name: '‹ 라이브러리'}));
  expect(back).toHaveBeenCalledOnce();
});
