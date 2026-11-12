import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import type {
  MediaImportProgress,
  MediaImportResult,
} from '@core/schema/mediaEdit';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {PowerPointImportFlow} from '@renderer/features/songs/import/PowerPointImportFlow';

describe('PowerPoint import dialog', () => {
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
    const api = mockLlpApi({
      ...fixture.api,
      powerpoint: {
        read: async () => ({
          ok: true,
          value: {
            fileName: 'deck.pptx',
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
    expect(importMedia).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith({path: 'C:/temp/ppt.png'});
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
        read: async () => ({
          ok: true,
          value: {
            fileName: 'deck.pptx',
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
        read: async () => ({
          ok: true,
          value: {
            fileName: 'deck.pptx',
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
        read: async () => ({
          ok: true,
          value: {
            fileName: 'deck.pptx',
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
        read: async () => ({
          ok: true,
          value: {
            fileName: 'deck.pptx',
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
