import {beforeEach, describe, expect, it, vi} from 'vitest';
import {libraryEndpoints} from '@contracts/ipc/library';
import {registerSongReveal} from '@main/store/revealSong';
import type {Logger} from '@main/base/log';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
const showItemInFolder = vi.hoisted(() => vi.fn<(path: string) => void>());
vi.mock('electron', () => ({
  ipcMain: ipc.ipcMain,
  shell: {showItemInFolder},
}));

const SONG = '00000000-0000-4000-8000-000000000051';

function mockLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
}

function ask(value: unknown): void {
  ipc.send(libraryEndpoints.revealSong, value);
}

const stops: Array<() => void> = [];

beforeEach(() => {
  for (const stop of stops.splice(0)) stop();
  showItemInFolder.mockClear();
});

describe('registerSongReveal', () => {
  const fileOf = (songId: string): Promise<string | undefined> =>
    Promise.resolve(songId === SONG ? 'C:/data/Songs/song.llsong' : undefined);

  it('shows the file main holds for the song id, and nothing for an unknown id', async () => {
    const log = mockLog();
    const stop = registerSongReveal({fileOf, windowMode: 'normal', log});
    ask({songId: SONG});
    await vi.waitFor(() =>
      expect(showItemInFolder).toHaveBeenCalledExactlyOnceWith(
        'C:/data/Songs/song.llsong',
      ),
    );
    ask({songId: '00000000-0000-4000-8000-000000000052'});
    await vi.waitFor(() =>
      expect(log.info).toHaveBeenCalledWith('no song file to reveal', {
        songId: '00000000-0000-4000-8000-000000000052',
      }),
    );
    expect(showItemInFolder).toHaveBeenCalledOnce();
    stop();
    expect(ipc.has(libraryEndpoints.revealSong.channel)).toBe(false);
  });

  it('drops a malformed request and a path, and never opens in an offscreen run', () => {
    const log = mockLog();
    const stop = registerSongReveal({fileOf, windowMode: 'normal', log});
    ask({path: 'C:/secret.txt'});
    ask('C:/secret.txt');
    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(showItemInFolder).not.toHaveBeenCalled();

    stop();
    const offscreen = mockLog();
    stops.push(
      registerSongReveal({fileOf, windowMode: 'offscreen', log: offscreen}),
    );
    ask({songId: SONG});
    expect(offscreen.info).toHaveBeenCalledWith(
      'song file reveal is unavailable in offscreen mode',
    );
    expect(showItemInFolder).not.toHaveBeenCalled();
  });
});
