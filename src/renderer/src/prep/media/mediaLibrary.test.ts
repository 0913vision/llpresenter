import {describe, expect, it, onTestFinished, vi} from 'vitest';
import type {MediaId} from '@shared/schema/ids';
import type {Notice} from '@renderer/ui/notices';
import {
  audioPlaylistId,
  mediaDocument,
  mediaFixture,
  mediaId,
  mediaItem,
  playlistId,
} from './mediaTesting';
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

  it('keeps a missing-files push over a first reply that arrives later', async () => {
    const fixture = mediaFixture();
    let reply: (missing: readonly MediaId[]) => void = () => undefined;
    fixture.missing.mockReturnValue(
      new Promise(resolve => {
        reply = resolve;
      }),
    );
    const {library, pushMissing} = setup(fixture);
    pushMissing([mediaId(2)]);
    reply([]);
    await Promise.resolve();
    expect(library.getSnapshot().missing).toEqual(new Set([mediaId(2)]));
  });

  it('takes the first reply, then follows the pushes after it', async () => {
    const fixture = mediaFixture();
    fixture.missing.mockResolvedValue([mediaId(1)]);
    const {library, pushMissing} = setup(fixture);
    await vi.waitFor(() =>
      expect(library.getSnapshot().missing).toEqual(new Set([mediaId(1)])),
    );
    pushMissing([mediaId(2)]);
    expect(library.getSnapshot().missing).toEqual(new Set([mediaId(2)]));
  });

  it('reports a rejected import, cancel, or relink, and relinks again after one', async () => {
    const {library, importFiles, edit, problems, write} = setup();
    importFiles.mockRejectedValue(new Error('Invented IPC failure'));
    edit.mockRejectedValue(new Error('Invented malformed reply'));
    await library.import(null);
    await library.cancel(mediaId(9), 'Invented.mp4');
    await library.relink(mediaId(1), 'Invented 1');
    expect(problems.mock.calls.map(([notice]) => notice.title)).toEqual([
      '미디어를 가져올 수 없음',
      '복사를 멈출 수 없음',
      '다시 연결할 수 없음',
    ]);
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({detail: 'Invented malformed reply'}),
    );
    edit.mockResolvedValue({ok: true, value: null});
    await library.relink(mediaId(1), 'Invented 1');
    expect(edit).toHaveBeenLastCalledWith({
      type: 'media.relink',
      mediaId: mediaId(1),
    });
    expect(problems).toHaveBeenCalledTimes(3);
  });

  it('remembers the playlist each import joins until it ends', async () => {
    const {library, importFiles, pushProgress} = setup();
    importFiles.mockResolvedValue({
      ok: true,
      value: [
        {...JOB, phase: 'queued', percent: 0},
        {
          mediaId: mediaId(10),
          fileName: 'Odd.txt',
          phase: 'failed',
          percent: 0,
          message: '지원하지 않는 형식',
        },
      ],
    });
    await library.import({kind: 'media', id: playlistId(1)});
    expect(library.getSnapshot().destinations).toEqual(
      new Map([[JOB.mediaId, playlistId(1)]]),
    );
    pushProgress({...JOB, phase: 'complete', percent: 100});
    expect(library.getSnapshot().destinations.size).toBe(0);
  });

  it('creates a playlist and answers its id, also when its save failed', async () => {
    const {library, edit, problems} = setup();
    edit.mockResolvedValueOnce({
      ok: true,
      value: {id: playlistId(1), revision: 2},
    });
    expect(await library.createPlaylist('media')).toBe(playlistId(1));
    edit.mockResolvedValueOnce({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented full disk',
        applied: {id: audioPlaylistId(1), revision: 3},
        unchangedFiles: ['media.json'],
      },
    });
    expect(await library.createPlaylist('audio')).toBe(audioPlaylistId(1));
    edit.mockRejectedValueOnce(new Error('Invented failure'));
    expect(await library.createPlaylist('media')).toBeNull();
    expect(problems.mock.calls.map(([notice]) => notice.title)).toEqual([
      '재생목록을 만들 수 없음',
    ]);
  });
});
