import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {StrictMode} from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import type {TextImportReadResult} from '@core/schema/songs/textImport';
import {convertTextImport} from '@core/songs/textImport';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {TextImportFlow} from '@renderer/features/songs/import/TextImportFlow';
import {
  closeSongDraft,
  openNewSong,
  editSongTitle,
  startSongDraftSync,
  useSongDraft,
} from '@renderer/features/songs/songDraft';
import {SongDraftDialogs} from '@renderer/features/songs/SongDraftDialogs';
import {useThemes} from '@renderer/platform/documents/themes';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {themes, themeScreens} from '@fixtures/core/themeOutput';
import {editorFixture} from '@fixtures/renderer/features/songs/editorFixture';

let stop = (): void => undefined;

const text = (value: string): TextImportReadResult => ({
  ok: true,
  value: {source: 'file', fileName: 'Invented.txt', text: value},
});

function setup(read: LlpApi['textImport']['read']) {
  const fixture = editorFixture();
  const api = mockLlpApi({
    ...fixture.api,
    textImport: {
      read,
      preview: request => Promise.resolve(convertTextImport(request)),
    },
  });
  window.llp = api;
  const onDone = vi.fn();
  const onProblem = vi.fn();
  stop = startSongDraftSync(api, onProblem);
  const show = (source: 'file' | 'clipboard' = 'file') =>
    render(
      <StrictMode>
        <TextImportFlow
          api={api}
          source={source}
          onDone={onDone}
          onProblem={onProblem}
        />
        <SongDraftDialogs />
      </StrictMode>,
    );
  return {show, onDone, onProblem};
}

const draft = () => useSongDraft.getState().draft;

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useThemes.setState({themes: themes(), screens: themeScreens});
});
afterEach(() => {
  act(closeSongDraft);
  stop();
  delete window.llp;
});

it('reads once, previews, and opens the unsaved song in the editor', async () => {
  const read = vi.fn<LlpApi['textImport']['read']>(() =>
    Promise.resolve(text('First line\n\nSecond line')),
  );
  const {show, onDone} = setup(read);
  show();
  await screen.findByText('슬라이드 3');
  expect(read).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', {name: '편집'}));
  expect(onDone).toHaveBeenCalledOnce();
  expect(draft()?.document).toBeNull();
  expect(draft()?.song.title).toBe('Invented');
  expect(
    draft()?.song.slides.map(slide => [
      slide.theme,
      ...Object.values(slide.texts),
    ]),
  ).toEqual([
    [BUILT_IN_THEME_IDS.songTitle, 'Invented'],
    [BUILT_IN_THEME_IDS.lyrics, 'First line'],
    [BUILT_IN_THEME_IDS.lyrics, 'Second line'],
  ]);
});

it('asks before it replaces a song that is not saved', async () => {
  const {show, onDone} = setup(() => Promise.resolve(text('Invented line')));
  act(() => {
    openNewSong();
    editSongTitle('적던 노래');
  });
  show();
  await screen.findByText('슬라이드 2');
  fireEvent.click(screen.getByRole('button', {name: '편집'}));
  const question = screen.getByRole('alertdialog');
  expect(draft()?.song.title).toBe('적던 노래');
  expect(onDone).not.toHaveBeenCalled();
  fireEvent.click(within(question).getByRole('button', {name: '저장 안 함'}));
  expect(draft()?.song.title).toBe('Invented');
  expect(onDone).toHaveBeenCalledOnce();
});

it('reads the file again with another encoding, keeping the latest reading', async () => {
  const read = vi.fn<LlpApi['textImport']['read']>(() =>
    Promise.resolve(text('Invented line')),
  );
  const {show} = setup(read);
  show();
  await screen.findByText('슬라이드 2');
  read.mockResolvedValueOnce(text('One\n\nTwo\n\nThree'));
  fireEvent.click(screen.getByRole('button', {name: '글자 인코딩'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: 'CP949'}));
  await screen.findByText('슬라이드 4');
  expect(read).toHaveBeenLastCalledWith({
    source: 'file',
    encoding: 'cp949',
    again: true,
  });
});

it('offers the encodings for a file that cannot be decoded', async () => {
  const read = vi.fn<LlpApi['textImport']['read']>(() =>
    Promise.resolve({
      ok: false,
      error: {reason: 'decode-failed', message: 'Invented decode failure'},
    }),
  );
  const {show, onDone, onProblem} = setup(read);
  show();
  expect(await screen.findByRole('dialog')).toBeTruthy();
  expect(onDone).not.toHaveBeenCalled();
  expect(onProblem).not.toHaveBeenCalled();
});

it.each(['cancel', 'failure'] as const)(
  'ends on a read %s without opening the editor',
  async outcome => {
    const {show, onDone, onProblem} = setup(() =>
      outcome === 'cancel'
        ? Promise.resolve({ok: true, value: null})
        : Promise.reject(new Error('Invented read failure')),
    );
    show('clipboard');
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onProblem).toHaveBeenCalledTimes(outcome === 'cancel' ? 0 : 1);
    expect(draft()).toBeNull();
  },
);
