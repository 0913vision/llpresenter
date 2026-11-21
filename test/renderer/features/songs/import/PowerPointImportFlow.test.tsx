import {act, render, screen, waitFor} from '@testing-library/react';
import {expect, it, onTestFinished, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {PowerPointImportFlow} from '@renderer/features/songs/import/PowerPointImportFlow';
import {preparePowerPointImages} from '@renderer/features/songs/import/preparePowerPointImages';

vi.mock('@renderer/features/songs/import/preparePowerPointImages', () => ({
  preparePowerPointImages: vi.fn(async () => ({
    ids: new Map(),
    full: new Map(),
    release: () => undefined,
  })),
}));
vi.mock('@renderer/features/songs/import/composePowerPointBackground', () => ({
  composePowerPointBackground: vi.fn(async () => ({
    mime: 'image/png',
    bytes: new Uint8Array([1]),
  })),
}));

it('opens all slides with lyrics and their backgrounds without showing an import dialog', async () => {
  const fixture = editorFixture();
  const store = new SongEditorStore(fixture.api, vi.fn());
  onTestFinished(() => store.dispose());
  const first = createMediaId('00000000-0000-4000-8000-000000000123');
  const second = createMediaId('00000000-0000-4000-8000-000000000124');
  const release = vi.fn(async () => true);
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
              background: 'a',
              shapes: [{body: false, lines: ['Song title']}],
            },
            {
              number: 2,
              background: 'b',
              shapes: [{body: true, lines: ['First verse']}],
            },
            {
              number: 3,
              background: 'a',
              shapes: [{body: true, lines: ['Second verse']}],
            },
            {number: 4, background: 'a', shapes: []},
          ],
        },
      }),
      background: async ({index}) => `C:/temp/${index}.png`,
      match: async ({path}) => (path.endsWith('/1.png') ? second : first),
      release,
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
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('checkbox', {name: '가사'})).toBeNull();
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(onEdit).toHaveBeenCalledOnce();
  expect(onProblem).not.toHaveBeenCalled();
  const song = store.getSnapshot().session?.history.snapshot.song;
  expect(song?.title).toBe('Song title');
  expect(song?.background).toBe(first);
  expect(song?.slides.map(slide => slide.picture)).toEqual([
    first,
    second,
    first,
    first,
  ]);
  expect(song?.slides.map(slide => slide.lines)).toEqual([
    ['Song title'],
    ['First verse'],
    ['Second verse'],
    [],
  ]);
  expect(release).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('uses the file name when no title exists and needs no background preparation', async () => {
  const fixture = editorFixture();
  const store = new SongEditorStore(fixture.api, vi.fn());
  onTestFinished(() => store.dispose());
  const api = mockLlpApi({
    ...fixture.api,
    powerpoint: {
      read: async () => ({
        ok: true,
        value: {
          fileName: 'hymn.ppt',
          widescreen: true,
          slides: [
            {
              number: 1,
              background: null,
              shapes: [{body: true, lines: ['Lyrics']}],
            },
          ],
        },
      }),
    },
  });
  const onEdit = vi.fn();
  const onDone = vi.fn();
  const calls = vi.mocked(preparePowerPointImages).mock.calls.length;
  render(
    <PowerPointImportFlow
      api={api}
      store={store}
      onDone={onDone}
      onEdit={onEdit}
      onProblem={vi.fn()}
    />,
  );
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(onEdit).toHaveBeenCalledOnce();
  expect(store.getSnapshot().session?.history.snapshot.song.title).toBe('hymn');
  expect(vi.mocked(preparePowerPointImages).mock.calls).toHaveLength(calls);
});

it('falls back to the layer renderer when a decoration cannot be exported', async () => {
  const fixture = editorFixture();
  const store = new SongEditorStore(fixture.api, vi.fn());
  onTestFinished(() => store.dispose());
  const media = createMediaId('00000000-0000-4000-8000-000000000123');
  const background = vi.fn(
    async (request: {index: number; decoration?: boolean}) =>
      request.decoration ? null : 'C:/temp/ppt.png',
  );
  const layers = vi.fn(async () => ({
    key: 'a'.repeat(64),
    layers: [],
    pictures: [],
    skipped: 0,
  }));
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
              background: 'a',
              shapes: [{body: true, lines: ['Verse']}],
            },
          ],
        },
      }),
      layers,
      background,
      match: async () => media,
      release: async () => true,
    },
  });
  const onDone = vi.fn();
  render(
    <PowerPointImportFlow
      api={api}
      store={store}
      onDone={onDone}
      onEdit={vi.fn()}
      onProblem={vi.fn()}
    />,
  );
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(layers).toHaveBeenCalledWith({index: 0});
  expect(background).toHaveBeenCalledWith({index: 0, decoration: true});
  expect(background).toHaveBeenCalledWith({
    index: 0,
    image: {mime: 'image/png', bytes: new Uint8Array([1])},
  });
  expect(store.getSnapshot().session?.history.snapshot.song.background).toBe(
    media,
  );
});

it('closes without opening a song when the picker is cancelled', async () => {
  const fixture = editorFixture();
  const store = new SongEditorStore(fixture.api, vi.fn());
  onTestFinished(() => store.dispose());
  const api = mockLlpApi({
    ...fixture.api,
    powerpoint: {read: async () => ({ok: true, value: null})},
  });
  const onEdit = vi.fn();
  const onDone = vi.fn();
  const onProblem = vi.fn();
  render(
    <PowerPointImportFlow
      api={api}
      store={store}
      onDone={onDone}
      onEdit={onEdit}
      onProblem={onProblem}
    />,
  );
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(onEdit).not.toHaveBeenCalled();
  expect(onProblem).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('reports a read failure without opening the editor or an import dialog', async () => {
  const fixture = editorFixture();
  const store = new SongEditorStore(fixture.api, vi.fn());
  onTestFinished(() => store.dispose());
  const api = mockLlpApi({
    ...fixture.api,
    powerpoint: {read: async () => ({ok: false, message: '파일 읽기 실패'})},
  });
  const onEdit = vi.fn();
  const onDone = vi.fn();
  const onProblem = vi.fn();
  render(
    <PowerPointImportFlow
      api={api}
      store={store}
      onDone={onDone}
      onEdit={onEdit}
      onProblem={onProblem}
    />,
  );
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(onEdit).not.toHaveBeenCalled();
  expect(onProblem).toHaveBeenCalledWith(
    expect.objectContaining({title: '파일 읽기 실패'}),
  );
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('does not open a draft if the flow is removed while reading', async () => {
  const fixture = editorFixture();
  const store = new SongEditorStore(fixture.api, vi.fn());
  onTestFinished(() => store.dispose());
  let finish: (
    value: Awaited<ReturnType<typeof fixture.api.powerpoint.read>>,
  ) => void = () => undefined;
  const read = vi.fn(
    () =>
      new Promise<Awaited<ReturnType<typeof fixture.api.powerpoint.read>>>(
        resolve => {
          finish = resolve;
        },
      ),
  );
  const cancelRead = vi.fn(async () => true);
  const api = mockLlpApi({...fixture.api, powerpoint: {read, cancelRead}});
  const onEdit = vi.fn();
  const onDone = vi.fn();
  const view = render(
    <PowerPointImportFlow
      api={api}
      store={store}
      onDone={onDone}
      onEdit={onEdit}
      onProblem={vi.fn()}
    />,
  );
  await waitFor(() => expect(read).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () =>
    finish({
      ok: true,
      value: {fileName: 'deck.pptx', widescreen: true, slides: []},
    }),
  );
  expect(cancelRead).toHaveBeenCalledOnce();
  expect(onEdit).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
});

it('does not replace a song opened while the file is being read', async () => {
  const fixture = editorFixture();
  const store = new SongEditorStore(fixture.api, vi.fn());
  onTestFinished(() => store.dispose());
  let finish: (
    value: Awaited<ReturnType<typeof fixture.api.powerpoint.read>>,
  ) => void = () => undefined;
  const read = vi.fn(
    () =>
      new Promise<Awaited<ReturnType<typeof fixture.api.powerpoint.read>>>(
        resolve => {
          finish = resolve;
        },
      ),
  );
  const api = mockLlpApi({...fixture.api, powerpoint: {read}});
  const onEdit = vi.fn();
  const onDone = vi.fn();
  const onProblem = vi.fn();
  render(
    <PowerPointImportFlow
      api={api}
      store={store}
      onDone={onDone}
      onEdit={onEdit}
      onProblem={onProblem}
    />,
  );
  await waitFor(() => expect(read).toHaveBeenCalledOnce());
  act(() => store.openNew());
  const original = store.getSnapshot().session;
  await act(async () =>
    finish({
      ok: true,
      value: {
        fileName: 'deck.pptx',
        widescreen: true,
        slides: [
          {
            number: 1,
            background: null,
            shapes: [{body: true, lines: ['lyrics']}],
          },
        ],
      },
    }),
  );
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(store.getSnapshot().session).toBe(original);
  expect(onEdit).not.toHaveBeenCalled();
  expect(onProblem).toHaveBeenCalledWith(
    expect.objectContaining({key: 'powerpoint:changed'}),
  );
  expect(screen.queryByRole('dialog')).toBeNull();
});
