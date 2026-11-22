import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {createMediaId} from '@core/schema/ids';
import type {
  PowerPointImageExportProgress,
  PowerPointSource,
} from '@core/schema/powerpointImport';
import {
  BUILT_IN_THEME_IDS,
  LIGHT_SONG_THEME_IDS,
} from '@core/theme/builtIn/ids';
import {PowerPointImportFlow} from '@renderer/features/songs/import/PowerPointImportFlow';
import {closeSongDraft, useSongDraft} from '@renderer/features/songs/songDraft';
import {useThemes} from '@renderer/platform/themes';
import type {Notice} from '@renderer/ui/notices';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {themes, themeScreens} from '@fixtures/core/themeOutput';
import {editorFixture} from '@fixtures/renderer/features/songs/editorFixture';

const PICTURE = createMediaId('10000000-0000-4000-8000-000000000001');
const background = (letter: string) => letter.repeat(64);

function source(
  texts: ReadonlyArray<readonly [role: 'title' | 'body', ...string[]]>,
  more: Partial<PowerPointSource['slides'][number]> = {},
): PowerPointSource {
  return {
    fileName: 'Invented.pptx',
    widescreen: true,
    slides: texts.map(([role, ...lines], index) => ({
      number: index + 1,
      shapes: [{role, lines}],
      background: background('a'),
      textColor: 0xffffff,
      ...more,
    })),
  };
}

const song = source([
  ['title', '새 노래'],
  ['body', '첫 줄', '둘째 줄'],
  ['body', '셋째 줄'],
]);

function setup({
  read = () => Promise.resolve({ok: true, value: song}),
  backgrounds = ({indices}) =>
    Promise.resolve(
      indices.map(index => ({index, path: `C:\\work\\${index}.png`})),
    ),
  match = () => Promise.resolve(PICTURE),
}: Partial<LlpApi['powerpoint']> = {}) {
  const fixture = editorFixture();
  let progress: (value: PowerPointImageExportProgress) => void = () =>
    undefined;
  const exported = vi.fn(backgrounds);
  const release = vi.fn(() => Promise.resolve(true));
  const cancelImages = vi.fn(() => Promise.resolve(true));
  const api = mockLlpApi({
    ...fixture.api,
    powerpoint: {
      read,
      backgrounds: exported,
      match,
      release,
      cancelImages,
      cancelRead: () => Promise.resolve(true),
      previewImage: () =>
        Promise.resolve({mime: 'image/png', bytes: new Uint8Array([1])}),
      subscribeImageProgress: listener => {
        progress = listener;
        return () => undefined;
      },
    },
  });
  window.llp = api;
  const onDone = vi.fn();
  const onProblem = vi.fn<(notice: Notice) => void>();
  const view = render(
    <PowerPointImportFlow api={api} onDone={onDone} onProblem={onProblem} />,
  );
  return {
    view,
    onDone,
    onProblem,
    exported,
    release,
    cancelImages,
    progress: (value: PowerPointImageExportProgress) => progress(value),
  };
}

const edit = () => screen.getByRole('button', {name: '편집'});
const enabled = () =>
  waitFor(() => expect(edit().getAttribute('aria-disabled')).toBeNull());
const draft = () => {
  const {draft: open} = useSongDraft.getState();
  if (open === null) throw new Error('No song is open');
  return open.song;
};

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
  vi.unstubAllGlobals();
  delete window.llp;
});

it('makes a song of the slides on their background, exported once', async () => {
  const {onDone, exported} = setup();
  await screen.findByText('슬라이드 3');
  await enabled();
  expect(exported).toHaveBeenCalledExactlyOnceWith({indices: [0]});
  fireEvent.click(edit());
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(draft().title).toBe('새 노래');
  expect(
    draft().slides.map(({theme, texts, background: own}) => ({
      theme,
      texts,
      own,
    })),
  ).toEqual([
    {
      theme: BUILT_IN_THEME_IDS.songTitle,
      texts: {제목: '새 노래'},
      own: {kind: 'media', media: PICTURE},
    },
    {
      theme: BUILT_IN_THEME_IDS.lyrics,
      texts: {가사: '첫 줄\n둘째 줄'},
      own: {kind: 'media', media: PICTURE},
    },
    {
      theme: BUILT_IN_THEME_IDS.lyrics,
      texts: {가사: '셋째 줄'},
      own: {kind: 'media', media: PICTURE},
    },
  ]);
});

it('shows the texts at once and waits for the backgrounds', async () => {
  let finish: () => void = () => undefined;
  const {progress} = setup({
    backgrounds: () =>
      new Promise(resolve => {
        finish = () => resolve([]);
      }),
  });
  await screen.findByText('슬라이드 3');
  expect(edit().getAttribute('aria-disabled')).toBe('true');
  expect(
    screen.getByRole('progressbar', {name: '배경 가져오는 중'}),
  ).toBeTruthy();
  await act(async () => {
    progress({
      done: 1,
      total: 1,
      picture: {index: 0, path: 'C:\\work\\0.png'},
    });
    await Promise.resolve();
  });
  await enabled();
  act(finish);
});

it('leaves the backgrounds out when they are not wanted', async () => {
  const {onDone} = setup();
  await screen.findByText('슬라이드 3');
  await enabled();
  fireEvent.click(screen.getByRole('checkbox', {name: '배경'}));
  fireEvent.click(edit());
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(draft().slides.every(slide => slide.background === undefined)).toBe(
    true,
  );
});

it('takes a range of the slides and the title it shows', async () => {
  const {onDone} = setup({
    read: () =>
      Promise.resolve({
        ok: true,
        value: source([
          ['title', '첫 노래'],
          ['body', '첫 가사'],
          ['title', '둘째 노래'],
          ['body', '둘째 가사'],
        ]),
      }),
  });
  await screen.findByText('슬라이드 4');
  await enabled();
  const tiles = screen.getAllByRole('option');
  const [, , third, fourth] = tiles;
  if (third === undefined || fourth === undefined) {
    throw new Error('Missing slides');
  }
  await userEvent.click(third);
  fireEvent.click(fourth, {shiftKey: true});
  expect(screen.getByText('슬라이드 2')).toBeTruthy();
  expect(
    screen.getByRole<HTMLInputElement>('textbox', {name: '제목'}).value,
  ).toBe('둘째 노래');
  fireEvent.click(edit());
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(draft().slides.map(slide => Object.values(slide.texts)[0])).toEqual([
    '둘째 노래',
    '둘째 가사',
  ]);
});

it('uses the themes for a bright background when the texts are dark', async () => {
  const {onDone} = setup({
    read: () =>
      Promise.resolve({
        ok: true,
        value: source(
          [
            ['title', '새 노래'],
            ['body', '가사'],
          ],
          {textColor: 0},
        ),
      }),
  });
  await screen.findByText('슬라이드 2');
  await enabled();
  fireEvent.click(edit());
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(draft().slides.map(slide => slide.theme)).toEqual([
    LIGHT_SONG_THEME_IDS.songTitle,
    LIGHT_SONG_THEME_IDS.lyrics,
  ]);
});

it('goes on without backgrounds when PowerPoint cannot export them', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const {onDone} = setup({
    backgrounds: () => Promise.reject(new Error('Invented failure')),
  });
  await screen.findByText('슬라이드 3');
  await enabled();
  fireEvent.click(edit());
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(draft().slides.every(slide => slide.background === undefined)).toBe(
    true,
  );
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});

it('stops the export and frees the pictures when it is closed', async () => {
  const {view, release, cancelImages} = setup();
  await screen.findByText('슬라이드 3');
  await enabled();
  view.unmount();
  expect(cancelImages).toHaveBeenCalled();
  expect(release).toHaveBeenCalledWith({path: 'C:\\work\\0.png'});
});

it.each([
  [{ok: true as const, value: null}, undefined],
  [{ok: false as const, message: '4:3 파일'}, '4:3 파일'],
])('ends without a song for %j', async (reply, title) => {
  const {onDone, onProblem} = setup({read: () => Promise.resolve(reply)});
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(onProblem.mock.calls.map(([notice]) => notice.title)).toEqual(
    title === undefined ? [] : [title],
  );
  expect(useSongDraft.getState().draft).toBeNull();
});
