import {describe, expect, it, onTestFinished, vi} from 'vitest';
import type {Notice} from '@renderer/ui/notices';
import {mediaDocument, mediaFixture, mediaId, mediaItem} from './mediaTesting';
import {MediaLibrary} from './mediaLibrary';

function setup(fixture = mediaFixture(mediaDocument([mediaItem(1)]))) {
  const library = new MediaLibrary(fixture.api);
  const problems = vi.fn<(notice: Notice) => void>();
  const stop = library.start(problems);
  onTestFinished(stop);
  return {...fixture, library, problems, stop};
}

const JOB = {mediaId: mediaId(9), fileName: 'Invented.mp4'} as const;

describe('media library for the media view', () => {
  it('reads the list and the missing files, and follows only newer lists', async () => {
    const {library, pushDocument, pushMissing} = setup();
    await vi.waitFor(() =>
      expect(library.getSnapshot().document?.revision).toBe(1),
    );
    pushDocument(mediaDocument([mediaItem(1), mediaItem(2)], 3));
    pushDocument(mediaDocument([], 2));
    expect(library.getSnapshot().document?.value.items).toHaveLength(2);
    pushMissing([mediaId(2)]);
    expect(library.getSnapshot().missing).toEqual(new Set([mediaId(2)]));
  });

  it('keeps imports in progress until they end, and reports a failed one', () => {
    const {library, problems, pushProgress} = setup();
    pushProgress({...JOB, phase: 'copying', percent: 40});
    expect(library.getSnapshot().jobs).toEqual([
      {...JOB, phase: 'copying', percent: 40},
    ]);
    pushProgress({
      ...JOB,
      phase: 'failed',
      percent: 100,
      message: '재생할 수 없는 형식',
    });
    expect(library.getSnapshot().jobs).toEqual([]);
    expect(problems).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '미디어를 가져오지 못함',
        meta: ['Invented.mp4', '재생할 수 없는 형식'],
      }),
    );
  });

  it('imports through the dialog into a playlist and shows the queued files', async () => {
    const {library, importFiles} = setup();
    importFiles.mockResolvedValue({
      ok: true,
      value: [{...JOB, phase: 'queued', percent: 0}],
    });
    await library.import(null);
    expect(importFiles).toHaveBeenCalledWith({
      source: {kind: 'dialog'},
      playlist: null,
    });
    expect(library.getSnapshot().jobs).toEqual([
      {...JOB, phase: 'queued', percent: 0},
    ]);
  });

  it('reports a refused import, cancel, or relink in Korean and logs the reason', async () => {
    const {library, importFiles, edit, problems, write} = setup();
    const refusal = {
      ok: false,
      error: {reason: 'invalid', message: 'Invented refusal'},
    } as const;
    importFiles.mockResolvedValue(refusal);
    edit.mockResolvedValue(refusal);
    await library.import(null);
    await library.cancel(mediaId(9), 'Invented.mp4');
    await library.relink(mediaId(1), 'Invented 1');
    expect(problems.mock.calls.map(([notice]) => notice.title)).toEqual([
      '미디어를 가져올 수 없음',
      '복사를 멈출 수 없음',
      '다시 연결할 수 없음',
    ]);
    expect(write).toHaveBeenCalledTimes(3);
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({detail: 'Invented refusal'}),
    );
  });

  it('stays quiet for a copy that already ended and a relink saved later', async () => {
    const {library, edit, problems} = setup();
    edit.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'not-found', message: 'This import already ended'},
    });
    await library.cancel(mediaId(9), 'Invented.mp4');
    edit.mockResolvedValueOnce({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented full disk',
        applied: {id: mediaId(1), revision: 2},
        unchangedFiles: ['media.json'],
      },
    });
    await library.relink(mediaId(1), 'Invented 1');
    expect(edit).toHaveBeenCalledWith({
      type: 'media.relink',
      mediaId: mediaId(1),
    });
    expect(problems).not.toHaveBeenCalled();
  });

  it('reports a list that cannot load and stops following on stop', async () => {
    const fixture = mediaFixture();
    const library = new MediaLibrary({
      ...fixture.api,
      media: {
        ...fixture.api.media,
        get: () => Promise.reject(new Error('Invented failure')),
      },
    });
    const problems = vi.fn<(notice: Notice) => void>();
    const stop = library.start(problems);
    await vi.waitFor(() =>
      expect(problems).toHaveBeenCalledWith(
        expect.objectContaining({title: '미디어를 불러오지 못함'}),
      ),
    );
    stop();
    expect(fixture.listeners.document.size).toBe(0);
    expect(fixture.listeners.imports.size).toBe(0);
    expect(fixture.listeners.missing.size).toBe(0);
  });
});
