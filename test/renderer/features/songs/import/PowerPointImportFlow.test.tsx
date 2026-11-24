import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {createMediaId, createSlideId} from '@core/schema/ids';
import type {
  PowerPointImageExportProgress,
  PowerPointReading,
  PowerPointSource,
} from '@core/schema/powerpointImport';
import {BUILT_IN_THEME_IDS, SONG_THEME_IDS} from '@core/theme/builtIn/ids';
import {PowerPointImportFlow} from '@renderer/features/songs/import/PowerPointImportFlow';
import {
  closeSongDraft,
  editSong,
  editSongTitle,
  openNewSong,
  replaySong,
  startSongDraftSync,
  useSongDraft,
} from '@renderer/features/songs/songDraft';
import {SongDraftDialogs} from '@renderer/features/songs/SongDraftDialogs';
import {useSongEditor} from '@renderer/features/songs/SongEditor';
import {useThemes} from '@renderer/platform/themes';
import {usePrepTarget} from '@renderer/session/prepTarget';
import type {Notice} from '@renderer/ui/popups/notices';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {themes, themeScreens} from '@fixtures/core/themeOutput';
import {editorFixture} from '@fixtures/renderer/features/songs/editorFixture';

const PICTURE = createMediaId('10000000-0000-4000-8000-000000000001');
const key = (letter: string) => letter.repeat(64);
let stop = (): void => undefined;

type Text = readonly [role: 'title' | 'body', ...string[]];

function source(
  texts: readonly Text[],
  of: (
    index: number,
  ) => Partial<PowerPointSource['slides'][number]> = () => ({}),
): PowerPointSource {
  return {
    fileName: 'Invented.pptx',
    widescreen: true,
    slides: texts.map(([role, ...lines], index) => ({
      number: index + 1,
      shapes: [{role, lines}],
      background: key('a'),
      textColor: 0xffffff,
      ...of(index),
    })),
  };
}

const song = source([
  ['title', '새 노래'],
  ['body', '첫 줄', '둘째 줄'],
  ['body', '셋째 줄'],
]);

function Editor(): JSX.Element {
  const editor = useSongEditor({report: vi.fn(), onBack: vi.fn()});
  return <>{editor?.editor}</>;
}

function setup({
  read = () => Promise.resolve({ok: true, value: song}),
  backgrounds = ({indices}) =>
    Promise.resolve(
      indices.map(index => ({index, path: `C:\\work\\${index}.png`})),
    ),
  storeImages = ({paths}) =>
    Promise.resolve({ok: true, value: paths.map(() => PICTURE)}),
}: Partial<LlpApi['powerpoint']> = {}) {
  const fixture = editorFixture();
  let progress: (value: PowerPointImageExportProgress) => void = () =>
    undefined;
  let reading: (value: PowerPointReading) => void = () => undefined;
  const exported = vi.fn(backgrounds);
  const release = vi.fn(() => Promise.resolve(true));
  const cancelImages = vi.fn(() => Promise.resolve(true));
  const cancelRead = vi.fn(() => Promise.resolve(true));
  const stored = vi.fn(storeImages);
  const edit = vi.fn(fixture.api.content.edit);
  const api = mockLlpApi({
    ...fixture.api,
    content: {edit},
    powerpoint: {
      read,
      backgrounds: exported,
      storeImages: stored,
      release,
      cancelImages,
      cancelRead,
      previewImage: () =>
        Promise.resolve({mime: 'image/png', bytes: new Uint8Array([1])}),
      subscribeImageProgress: listener => {
        progress = listener;
        return () => undefined;
      },
      subscribeReading: listener => {
        reading = listener;
        return () => undefined;
      },
    },
  });
  window.llp = api;
  stop = startSongDraftSync(api, vi.fn());
  const onDone = vi.fn();
  const onProblem = vi.fn<(notice: Notice) => void>();
  const onDismiss = vi.fn();
  const show = () =>
    render(
      <>
        <PowerPointImportFlow
          api={api}
          onDone={onDone}
          onProblem={onProblem}
          onDismiss={onDismiss}
        />
        <Editor />
        <SongDraftDialogs />
      </>,
    );
  return {
    show,
    onDone,
    onProblem,
    onDismiss,
    exported,
    release,
    cancelImages,
    cancelRead,
    stored,
    edit,
    progress: (value: PowerPointImageExportProgress) => progress(value),
    reading: (value: PowerPointReading) => reading(value),
  };
}

const view = () => useSongDraft.getState();
const draft = () => {
  const {draft: open} = view();
  if (open === null) throw new Error('No song is open');
  return open.song;
};
const opened = () => waitFor(() => expect(view().draft).not.toBeNull());
const filled = () => waitFor(() => expect(view().pictures?.busy).toBe(false));
const backgrounds = () =>
  draft().slides.map(slide =>
    slide.background?.kind === 'media' ? slide.background.media : null,
  );

beforeEach(() => {
  useThemes.setState({themes: themes(), screens: themeScreens});
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override createObjectURL() {
        return 'blob:invented';
      }
      static override revokeObjectURL() {}
    },
  );
});
afterEach(() => {
  act(closeSongDraft);
  stop();
  vi.unstubAllGlobals();
  delete window.llp;
});

it('opens the song in the editor at once, without a dialog', async () => {
  const {show, onDone} = setup({
    backgrounds: () => new Promise(() => undefined),
  });
  show();
  await opened();
  expect(onDone).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(usePrepTarget.getState().target).toEqual({kind: 'song'});
  expect(draft().title).toBe('새 노래');
  expect(draft().slides.map(slide => [slide.theme, slide.texts])).toEqual([
    [BUILT_IN_THEME_IDS.songTitle, {제목: '새 노래'}],
    [BUILT_IN_THEME_IDS.lyrics, {가사: '첫 줄\n둘째 줄'}],
    [BUILT_IN_THEME_IDS.lyrics, {가사: '셋째 줄'}],
  ]);
  expect(view().draft?.document).toBeNull();
  expect(
    screen.getByRole('progressbar', {name: '배경 가져오는 중'}),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', {name: '저장'}).getAttribute('aria-disabled'),
  ).toBe('true');
});

it('fills the backgrounds in as they come, exporting each picture once', async () => {
  const {show, exported} = setup();
  show();
  await opened();
  await filled();
  expect(exported).toHaveBeenCalledExactlyOnceWith({indices: [0]});
  const [first] = backgrounds();
  expect(first).not.toBeNull();
  expect(backgrounds()).toEqual([first, first, first]);
  expect(screen.queryByRole('progressbar')).toBeNull();
});

it('puts a background behind the slides it was changed into meanwhile', async () => {
  const {show, progress} = setup({
    backgrounds: () => new Promise(() => undefined),
  });
  show();
  await opened();
  const [plain] = backgrounds();
  expect(plain).not.toBeNull();
  act(() =>
    editSong(current => ({
      ...current,
      slides: current.slides.flatMap((slide, index) => {
        const {background, ...bare} = slide;
        if (index === 0) return [bare];
        if (index === 1) return [{...slide, texts: {가사: '고친 줄'}}];
        return [
          slide,
          {...bare, id: createSlideId(crypto.randomUUID()), background},
        ];
      }),
    })),
  );
  await act(async () => {
    progress({
      done: 1,
      total: 1,
      picture: {index: 0, path: 'C:\\work\\0.png'},
    });
    await Promise.resolve();
  });
  await waitFor(() => expect(backgrounds()[1]).not.toBe(plain));
  const [own, first, ...rest] = backgrounds();
  expect(own).toBeNull();
  expect(rest).toEqual([first, first]);
  expect(draft().slides[1]?.texts['가사']).toBe('고친 줄');
  act(() => replaySong('undo'));
  expect(draft().slides[1]?.texts['가사']).toBe('첫 줄\n둘째 줄');
  expect(backgrounds()).toEqual([first, first, first]);
});

it('makes media files only of the backgrounds that are saved', async () => {
  const two = source(
    [
      ['title', '새 노래'],
      ['body', '첫 줄'],
      ['body', '다른 배경'],
    ],
    index => ({background: key(index === 2 ? 'b' : 'a')}),
  );
  const {show, stored, edit} = setup({
    read: () => Promise.resolve({ok: true, value: two}),
  });
  show();
  await opened();
  await filled();
  expect(stored).not.toHaveBeenCalled();
  act(() =>
    editSong(current => ({...current, slides: current.slides.slice(0, 2)})),
  );
  edit.mockResolvedValueOnce({
    ok: true,
    value: {id: draft().id, revision: 1},
  });
  await userEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(edit).toHaveBeenCalledOnce());
  expect(stored).toHaveBeenCalledExactlyOnceWith({
    paths: ['C:\\work\\0.png'],
    title: '새 노래',
  });
  expect(edit.mock.calls[0]?.[0]).toMatchObject({
    type: 'song.import',
    draft: {
      slides: [
        {background: {kind: 'media', media: PICTURE}},
        {background: {kind: 'media', media: PICTURE}},
      ],
    },
  });
});

it('keeps the song open when its backgrounds cannot be stored', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const {show, edit} = setup({
    storeImages: () => Promise.resolve({ok: false, message: 'Invented'}),
  });
  show();
  await opened();
  await filled();
  const before = backgrounds();
  await userEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(view().saving).toBe(false));
  expect(edit).not.toHaveBeenCalled();
  expect(backgrounds()).toEqual(before);
  expect(screen.queryByRole('progressbar')).toBeNull();
  log.mockRestore();
});

it('gives the theme for a bright background to the slides on it', async () => {
  const {show} = setup({
    read: () =>
      Promise.resolve({
        ok: true,
        value: source(
          [
            ['title', '밝은 노래'],
            ['body', '첫 줄'],
            ['title', '어두운 노래'],
            ['body', '둘째 줄'],
          ],
          index => ({
            background: key(index < 2 ? 'a' : 'b'),
            textColor: index < 2 ? 0 : 0xffffff,
          }),
        ),
      }),
  });
  show();
  await opened();
  expect(draft().slides.map(slide => slide.theme)).toEqual([
    SONG_THEME_IDS.light.title,
    SONG_THEME_IDS.light.lyrics,
    BUILT_IN_THEME_IDS.songTitle,
    BUILT_IN_THEME_IDS.lyrics,
  ]);
});

it('says so when PowerPoint cannot export the backgrounds', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const {show, onProblem} = setup({
    backgrounds: () => Promise.reject(new Error('Invented failure')),
  });
  show();
  await opened();
  await filled();
  expect(backgrounds()).toEqual([null, null, null]);
  expect(onProblem.mock.calls.map(([notice]) => notice.title)).toEqual([
    '배경을 모두 가져오지 못했습니다.',
  ]);
  log.mockRestore();
});

it('asks before it replaces a song that is not saved', async () => {
  const {show, cancelRead} = setup();
  act(() => {
    openNewSong();
    editSongTitle('적던 노래');
  });
  show();
  await screen.findByRole('alertdialog');
  expect(draft().title).toBe('적던 노래');
  fireEvent.click(screen.getByRole('button', {name: '취소'}));
  expect(draft().title).toBe('적던 노래');
  expect(cancelRead).toHaveBeenCalled();
});

it('frees the pictures when the song is left', async () => {
  const {show, release, cancelImages, cancelRead} = setup();
  show();
  await opened();
  await filled();
  expect(cancelRead).toHaveBeenCalledOnce();
  expect(release).not.toHaveBeenCalled();
  act(closeSongDraft);
  expect(release).toHaveBeenCalledExactlyOnceWith({path: 'C:\\work\\0.png'});
  expect(cancelImages).not.toHaveBeenCalled();
  expect(cancelRead).toHaveBeenCalledOnce();
});

it('stops the export when the song is left before it ends', async () => {
  const {show, cancelImages, cancelRead} = setup({
    backgrounds: () => new Promise(() => undefined),
  });
  show();
  await opened();
  act(closeSongDraft);
  expect(cancelImages).toHaveBeenCalledOnce();
  expect(cancelRead).toHaveBeenCalledOnce();
});

it('says that a chosen file is read, and lets it be cancelled', async () => {
  let finish: (
    value: Awaited<ReturnType<LlpApi['powerpoint']['read']>>,
  ) => void = () => undefined;
  const {show, reading, onProblem, onDismiss, cancelRead, onDone} = setup({
    read: () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  });
  show();
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  expect(onProblem).not.toHaveBeenCalled();
  act(() => reading({fileName: '찬양.ppt'}));
  const [notice] = onProblem.mock.calls[0] ?? [];
  expect(notice).toMatchObject({
    title: 'PowerPoint 읽는 중',
    meta: ['찬양.ppt'],
  });
  notice?.actions?.[0]?.onSelect();
  expect(cancelRead).toHaveBeenCalledOnce();
  await act(async () => {
    finish({ok: true, value: null});
    await Promise.resolve();
  });
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(onDismiss).toHaveBeenCalledWith('powerpoint:read');
  expect(view().draft).toBeNull();
});

it.each([
  [{ok: true as const, value: null}, undefined],
  [{ok: false as const, message: '4:3 파일'}, '4:3 파일'],
])('ends without a song for %j', async (reply, message) => {
  const {show, onDone, onProblem} = setup({
    read: () => Promise.resolve(reply),
  });
  show();
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(onProblem.mock.calls.map(([{title, meta}]) => [title, meta])).toEqual(
    message === undefined ? [] : [['PowerPoint 가져오기 실패', [message]]],
  );
  expect(view().draft).toBeNull();
});
