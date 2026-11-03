import {beforeEach, describe, expect, it, vi} from 'vitest';
import {libraryEndpoints} from '@contracts/ipc/library';
import {registerSongReveal} from '@main/store/revealSong';
import type {Logger} from '@main/log';

type Listener = (event: unknown, value: unknown) => void;

const electron = vi.hoisted(() => ({
  listeners: new Map<string, Listener>(),
  showItemInFolder: vi.fn<(path: string) => void>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, listener: Listener) => {
      electron.listeners.set(channel, listener);
    },
    removeListener: (channel: string) => {
      electron.listeners.delete(channel);
    },
  },
  shell: {showItemInFolder: electron.showItemInFolder},
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
  electron.listeners.get(libraryEndpoints.revealSong.channel)?.({}, value);
}

beforeEach(() => {
  electron.listeners.clear();
  electron.showItemInFolder.mockClear();
});

describe('registerSongReveal', () => {
  const fileOf = (songId: string): Promise<string | undefined> =>
    Promise.resolve(songId === SONG ? 'C:/data/Songs/song.llsong' : undefined);

  it('shows the file main holds for the song id, and nothing for an unknown id', async () => {
    const log = mockLog();
    const stop = registerSongReveal({fileOf, windowMode: 'normal', log});
    ask({songId: SONG});
    await vi.waitFor(() =>
      expect(electron.showItemInFolder).toHaveBeenCalledExactlyOnceWith(
        'C:/data/Songs/song.llsong',
      ),
    );
    ask({songId: '00000000-0000-4000-8000-000000000052'});
    await vi.waitFor(() =>
      expect(log.info).toHaveBeenCalledWith('no song file to reveal', {
        songId: '00000000-0000-4000-8000-000000000052',
      }),
    );
    expect(electron.showItemInFolder).toHaveBeenCalledOnce();
    stop();
    expect(electron.listeners.has(libraryEndpoints.revealSong.channel)).toBe(
      false,
    );
  });

  it('drops a malformed request and a path, and never opens in an offscreen run', () => {
    const log = mockLog();
    registerSongReveal({fileOf, windowMode: 'normal', log});
    ask({path: 'C:/secret.txt'});
    ask('C:/secret.txt');
    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(electron.showItemInFolder).not.toHaveBeenCalled();

    electron.listeners.clear();
    const offscreen = mockLog();
    registerSongReveal({fileOf, windowMode: 'offscreen', log: offscreen});
    ask({songId: SONG});
    expect(offscreen.info).toHaveBeenCalledWith(
      'song file reveal is unavailable in offscreen mode',
    );
    expect(electron.showItemInFolder).not.toHaveBeenCalled();
  });
});
