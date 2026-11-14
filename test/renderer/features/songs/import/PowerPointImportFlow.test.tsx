import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import {LIGHT_SONG_THEME_ID} from '@core/themes/lightSong';
import type {
  MediaImportProgress,
  MediaImportResult,
} from '@core/schema/mediaEdit';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {PowerPointImportFlow} from '@renderer/features/songs/import/PowerPointImportFlow';

vi.mock('@renderer/features/songs/import/composePowerPointBackground', () => ({
  composePowerPointBackground: vi.fn(async () => ({
    mime: 'image/png',
    bytes: new Uint8Array([1]),
  })),
}));

const mockScene = {key: 'a'.repeat(64), layers: [], pictures: [], skipped: 0};

describe('PowerPoint import dialog', () => {
  it.each([
    {
      name: 'one-box hymn',
      shapes: [
        {
          body: false,
          lines: ['새찬송가 91장', '슬픈 마음 있는 사람'],
          lyricFormat: {
            lines: [
              {
                boxWidth: 1733,
                top: 154,
                runs: [{text: '새찬송가 91장', size: 88}],
              },
              {
                boxWidth: 1733,
                top: 269,
                runs: [{text: '슬픈 마음 있는 사람', size: 120}],
              },
            ],
          },
        },
      ],
      expected: '새찬송가 91장 슬픈 마음 있는 사람',
      lines: ['새찬송가 91장', '슬픈 마음 있는 사람'],
    },
    {
      name: 'two-box song',
      shapes: [
        {
          body: false,
          lines: ['아름다운 나라'],
          lyricFormat: {
            lines: [
              {
                boxWidth: 1106,
                top: 176,
                runs: [{text: '아름다운 나라', size: 120}],
              },
            ],
          },
        },
        {
          body: false,
          lines: ['Kingdom Beautiful'],
          lyricFormat: {
            lines: [
              {
                boxWidth: 1416,
                top: 343,
                runs: [{text: 'Kingdom Beautiful', size: 64}],
              },
            ],
          },
        },
      ],
      expected: '아름다운 나라',
      lines: ['아름다운 나라', 'Kingdom Beautiful'],
    },
  ])(
    'names $name from its first title box and keeps the formatted slide',
    async ({shapes, expected, lines}) => {
      const fixture = editorFixture();
      const store = new SongEditorStore(fixture.api, vi.fn());
      onTestFinished(() => store.dispose());
      const onEdit = vi.fn();
      const api = mockLlpApi({
        ...fixture.api,
        powerpoint: {
          read: async () => ({
            ok: true,
            value: {
              fileName: 'deck.pptx',
              widescreen: true,
              slides: [{number: 1, background: null, shapes}],
            },
          }),
        },
      });
      render(
        <PowerPointImportFlow
          api={api}
          store={store}
          onDone={vi.fn()}
          onEdit={onEdit}
          onProblem={vi.fn()}
        />,
      );
      const title = await screen.findByRole('textbox', {name: '제목'});
      expect(title).toHaveProperty('value', expected);
      fireEvent.click(screen.getByRole('button', {name: '편집'}));
      await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
      const song = store.getSnapshot().session?.history.snapshot.song;
      expect(song?.title).toBe(expected);
      expect(song?.slides[0]).toMatchObject({
        titleSlide: true,
        lines,
        lyricFormat: {lines: shapes.flatMap(shape => shape.lyricFormat.lines)},
      });
    },
  );
  it.each([
    {first: 0, last: 8, winner: 0},
    {first: 7, last: 11, winner: 9},
    {first: 8, last: 0, winner: 0},
  ])(
    'chooses the most common background in the selected slides: $first to $last',
    async ({first, last, winner}) => {
      const fixture = editorFixture();
      const store = new SongEditorStore(fixture.api, vi.fn());
      onTestFinished(() => store.dispose());
      const mediaId = createMediaId('00000000-0000-4000-8000-000000000123');
      const layers = vi.fn(async () => mockScene);
      const onEdit = vi.fn();
      const api = mockLlpApi({
        ...fixture.api,
        powerpoint: {
          read: async () => ({
            ok: true,
            value: {
              fileName: 'deck.pptx',
              widescreen: true,
              slides: Array.from({length: 31}, (_, index) => ({
                number: index + 1,
                background: index < 9 ? 'sky-layout' : 'field-layout',
                shapes: [{body: true, lines: [`Slide ${index + 1}`]}],
              })),
            },
          }),
          layers,
          background: async () => 'C:/temp/ppt.png',
          match: async () => mediaId,
          release: async () => true,
        },
      });
      render(
        <PowerPointImportFlow
          api={api}
          store={store}
          onDone={vi.fn()}
          onEdit={onEdit}
          onProblem={vi.fn()}
        />,
      );
      const options = await screen.findAllByRole('option');
      const start = options[first];
      const end = options[last];
      if (!start || !end) throw new Error('Missing slide option');
      fireEvent.click(start);
      fireEvent.click(end, {shiftKey: true});
      fireEvent.click(screen.getByRole('button', {name: '편집'}));
      await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
      expect(layers).toHaveBeenCalledWith({index: winner});
      expect(
        store.getSnapshot().session?.history.snapshot.song.background,
      ).toBe(mediaId);
    },
  );

  it('reuses matching media instead of importing a second image', async () => {
    const fixture = editorFixture();
    const store = new SongEditorStore(fixture.api, vi.fn());
    onTestFinished(() => store.dispose());
    const mediaId = createMediaId('00000000-0000-4000-8000-000000000123');
    const importMedia = vi.fn(async (): Promise<MediaImportResult> => ({
      ok: true,
      value: [],
    }));
    const release = vi.fn(async () => true);
    const background = vi.fn(async () => 'C:/temp/ppt.png');
    const api = mockLlpApi({
      ...fixture.api,
      powerpoint: {
        layers: async () => mockScene,
        read: async () => ({
          ok: true,
          value: {
            fileName: 'deck.pptx',
            widescreen: true,
            slides: [
              {
                number: 1,
                background: 'ppt/media/bg.png',
                lyricColor: 0,
                shapes: [{body: true, lines: ['Title']}],
              },
            ],
          },
        }),
        background,
        match: async () => mediaId,
        release,
      },
      media: {import: importMedia},
    });
    const onEdit = vi.fn();
    render(
      <PowerPointImportFlow
        api={api}
        store={store}
        onDone={vi.fn()}
        onEdit={onEdit}
        onProblem={vi.fn()}
      />,
    );
    await screen.findByRole('dialog', {name: 'PowerPoint 가져오기'});
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
    expect(store.getSnapshot().session?.history.snapshot.song.background).toBe(
      mediaId,
    );
    expect(store.getSnapshot().session?.history.snapshot.song.theme).toBe(
      LIGHT_SONG_THEME_ID,
    );
    expect(importMedia).not.toHaveBeenCalled();
    expect(background).toHaveBeenCalledWith({
      index: 0,
      image: {mime: 'image/png', bytes: new Uint8Array([1])},
    });
    expect(release).toHaveBeenCalledWith({path: 'C:/temp/ppt.png'});
  });

  it.each(['lyrics', 'background'] as const)(
    'imports only the selected %s and keeps one choice checked',
    async choice => {
      const fixture = editorFixture();
      const store = new SongEditorStore(fixture.api, vi.fn());
      onTestFinished(() => store.dispose());
      const mediaId = createMediaId('00000000-0000-4000-8000-000000000123');
      const layers = vi.fn(async () => mockScene);
      const onDone = vi.fn();
      const onEdit = vi.fn();
      const api = mockLlpApi({
        ...fixture.api,
        powerpoint: {
          read: async () => ({
            ok: true,
            value: {
              fileName: 'deck.pptx',
              widescreen: true,
              slides: [
                {
                  number: 1,
                  background: 'key',
                  shapes: [{body: true, lines: ['Lyric']}],
                },
              ],
            },
          }),
          layers,
          background: async () => 'C:/temp/ppt.png',
          match: async () => mediaId,
          release: async () => true,
        },
      });
      render(
        <PowerPointImportFlow
          api={api}
          store={store}
          onDone={onDone}
          onEdit={onEdit}
          onProblem={vi.fn()}
        />,
      );
      await screen.findByRole('dialog', {name: 'PowerPoint 가져오기'});
      const lyrics = screen.getByRole('checkbox', {name: '가사'});
      const background = screen.getByRole('checkbox', {name: '배경'});
      fireEvent.click(choice === 'lyrics' ? background : lyrics);
      const remaining = choice === 'lyrics' ? lyrics : background;
      fireEvent.click(remaining);
      expect(remaining.getAttribute('aria-checked')).toBe('true');
      fireEvent.click(
        screen.getByRole('button', {
          name: choice === 'lyrics' ? '편집' : '가져오기',
        }),
      );
      await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
      expect(layers).toHaveBeenCalledTimes(choice === 'background' ? 1 : 0);
      expect(onEdit).toHaveBeenCalledTimes(choice === 'lyrics' ? 1 : 0);
      if (choice === 'lyrics') {
        expect(
          store.getSnapshot().session?.history.snapshot.song.background,
        ).toBeFalsy();
      } else {
        expect(store.getSnapshot().session).toBeNull();
      }
    },
  );

  it('disables background for non-widescreen decks', async () => {
    const fixture = editorFixture();
    const store = new SongEditorStore(fixture.api, vi.fn());
    onTestFinished(() => store.dispose());
    const api = mockLlpApi({
      ...fixture.api,
      powerpoint: {
        read: async () => ({
          ok: true,
          value: {
            fileName: 'deck.pptx',
            widescreen: false,
            slides: [{number: 1, background: null, shapes: []}],
          },
        }),
      },
    });
    render(
      <PowerPointImportFlow
        api={api}
        store={store}
        onDone={vi.fn()}
        onEdit={vi.fn()}
        onProblem={vi.fn()}
      />,
    );
    const background = await screen.findByRole('checkbox', {name: '배경'});
    expect(background.getAttribute('aria-disabled')).toBe('true');
    expect(background.getAttribute('aria-checked')).toBe('false');
  });

  it('releases the temporary image when media import immediately fails', async () => {
    const fixture = editorFixture();
    const store = new SongEditorStore(fixture.api, vi.fn());
    onTestFinished(() => store.dispose());
    const mediaId = createMediaId('00000000-0000-4000-8000-000000000123');
    const release = vi.fn(async () => true);
    const onProblem = vi.fn();
    const api = mockLlpApi({
      ...fixture.api,
      powerpoint: {
        layers: async () => mockScene,
        read: async () => ({
          ok: true,
          value: {
            fileName: 'deck.pptx',
            widescreen: true,
            slides: [
              {
                number: 1,
                background: 'ppt/media/bg.png',
                shapes: [{body: false, lines: ['Title']}],
              },
            ],
          },
        }),
        background: async () => 'C:/temp/ppt.png',
        release,
      },
      media: {
        import: async () => ({
          ok: true,
          value: [
            {
              mediaId,
              fileName: 'ppt.png',
              phase: 'failed',
              percent: 0,
              message: 'failed',
            },
          ],
        }),
      },
    });
    render(
      <PowerPointImportFlow
        api={api}
        store={store}
        onDone={vi.fn()}
        onEdit={vi.fn()}
        onProblem={onProblem}
      />,
    );
    await screen.findByRole('dialog', {name: 'PowerPoint 가져오기'});
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    await waitFor(() =>
      expect(release).toHaveBeenCalledWith({path: 'C:/temp/ppt.png'}),
    );
    await waitFor(() => expect(onProblem).toHaveBeenCalledOnce());
    expect(store.getSnapshot().session).toBeNull();
  });

  it('releases an extracted image if the dialog was cancelled before it arrived', async () => {
    const fixture = editorFixture();
    const store = new SongEditorStore(fixture.api, vi.fn());
    onTestFinished(() => store.dispose());
    let finish: (path: string | null) => void = () => undefined;
    const pending = new Promise<string | null>(resolve => {
      finish = resolve;
    });
    const background = vi.fn(() => pending);
    const release = vi.fn(async () => true);
    const importMedia = vi.fn(async (): Promise<MediaImportResult> => ({
      ok: true,
      value: [],
    }));
    const api = mockLlpApi({
      ...fixture.api,
      powerpoint: {
        layers: async () => mockScene,
        read: async () => ({
          ok: true,
          value: {
            fileName: 'deck.pptx',
            widescreen: true,
            slides: [
              {
                number: 1,
                background: 'ppt/media/bg.png',
                shapes: [{body: false, lines: ['Title']}],
              },
            ],
          },
        }),
        background,
        release,
      },
      media: {import: importMedia},
    });
    const onEdit = vi.fn();
    const view = render(
      <PowerPointImportFlow
        api={api}
        store={store}
        onDone={vi.fn()}
        onEdit={onEdit}
        onProblem={vi.fn()}
      />,
    );
    await screen.findByRole('dialog', {name: 'PowerPoint 가져오기'});
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    await waitFor(() => expect(background).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', {name: '저장 안 함'}));
    view.unmount();
    await act(async () => {
      finish('C:/temp/ppt.png');
    });
    await waitFor(() =>
      expect(release).toHaveBeenCalledWith({path: 'C:/temp/ppt.png'}),
    );
    expect(importMedia).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('does not open a cancelled draft after a deferred background import finishes', async () => {
    const fixture = editorFixture();
    const store = new SongEditorStore(fixture.api, vi.fn());
    onTestFinished(() => store.dispose());
    const mediaId = createMediaId('00000000-0000-4000-8000-000000000123');
    let finish: (result: MediaImportResult) => void = () => undefined;
    const pending = new Promise<MediaImportResult>(resolve => {
      finish = resolve;
    });
    let emit: (event: MediaImportProgress) => void = () => undefined;
    const importMedia = vi.fn(() => pending);
    const release = vi.fn(async () => true);
    const api = mockLlpApi({
      ...fixture.api,
      powerpoint: {
        layers: async () => mockScene,
        read: async () => ({
          ok: true,
          value: {
            fileName: 'deck.pptx',
            widescreen: true,
            slides: [
              {
                number: 1,
                background: 'ppt/media/bg.png',
                shapes: [{body: false, lines: ['Title']}],
              },
            ],
          },
        }),
        background: async () => 'C:/temp/ppt.png',
        release,
      },
      media: {
        import: importMedia,
        subscribeImports: listener => {
          emit = listener;
          return () => undefined;
        },
      },
    });
    const onDone = vi.fn();
    const onEdit = vi.fn();
    const onProblem = vi.fn();
    const view = render(
      <PowerPointImportFlow
        api={api}
        store={store}
        onDone={onDone}
        onEdit={onEdit}
        onProblem={onProblem}
      />,
    );
    await screen.findByRole('dialog', {name: 'PowerPoint 가져오기'});
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    await waitFor(() => expect(importMedia).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', {name: '저장 안 함'}));
    view.unmount();
    store.openNew();
    const newerSession = store.getSnapshot().session;
    expect(newerSession).not.toBeNull();
    await act(async () => {
      finish({
        ok: true,
        value: [{mediaId, fileName: 'ppt.png', phase: 'queued', percent: 0}],
      });
      emit({mediaId, fileName: 'ppt.png', phase: 'complete', percent: 100});
    });
    await waitFor(() =>
      expect(release).toHaveBeenCalledWith({path: 'C:/temp/ppt.png'}),
    );
    expect(store.getSnapshot().session).toBe(newerSession);
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('selects an inclusive range and opens exactly those slides in the editor', async () => {
    const fixture = editorFixture();
    const store = new SongEditorStore(fixture.api, vi.fn());
    onTestFinished(() => store.dispose());
    const shape = (body: boolean, ...lines: string[]) => ({body, lines});
    const api = mockLlpApi({
      ...fixture.api,
      powerpoint: {
        layers: async () => mockScene,
        read: async () => ({
          ok: true,
          value: {
            fileName: 'deck.pptx',
            widescreen: true,
            slides: [
              {number: 1, background: null, shapes: [shape(false, 'Other')]},
              {
                number: 2,
                background: null,
                shapes: [shape(false, 'Title'), shape(false, 'Subtitle')],
              },
              {number: 3, background: null, shapes: [shape(true, 'Lyric')]},
              {number: 4, background: null, shapes: []},
              {number: 5, background: null, shapes: [shape(false, 'Title')]},
            ],
          },
        }),
      },
    });
    const onEdit = vi.fn();
    const onDone = vi.fn();
    render(
      <PowerPointImportFlow
        api={api}
        store={store}
        onDone={onDone}
        onEdit={onEdit}
        onProblem={vi.fn()}
      />,
    );
    const title = await screen.findByRole('option', {name: /2.*Title/});
    fireEvent.click(title);
    fireEvent.click(screen.getByRole('option', {name: /5.*Title/}), {
      shiftKey: true,
    });
    const name = screen.getByRole('textbox', {name: '제목'});
    expect(name instanceof HTMLInputElement && name.value).toBe('Title');
    expect(screen.getByText('슬라이드 4')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
    const slides = store.getSnapshot().session?.history.snapshot.song.slides;
    expect(
      slides?.map(slide => ({
        lines: slide.lines,
        titleSlide: slide.titleSlide,
      })),
    ).toEqual([
      {lines: ['Title', 'Subtitle'], titleSlide: true},
      {lines: ['Lyric'], titleSlide: undefined},
      {lines: [], titleSlide: undefined},
      {lines: ['Title'], titleSlide: true},
    ]);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
