import {beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {startAudio} from './startAudio';

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});
describe('startAudio', () => {
  it('waits for main clock, defaults to mute, follows state, and releases on pagehide', async () => {
    let resolve: (value: number) => void = () => {};
    const reading = new Promise<number>(done => {
      resolve = done;
    });
    const subscribe = vi.fn(() => vi.fn());
    const api = fakeLlpApi({live: {clock: () => reading, subscribe}});
    const root = document.createElement('div');
    const stop = startAudio({root, api});
    await Promise.resolve();
    expect(subscribe).not.toHaveBeenCalled();
    resolve(1000);
    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledOnce());
    expect(
      [...root.querySelectorAll('audio')].every(element => element.muted),
    ).toBe(true);
    window.dispatchEvent(new Event('pagehide'));
    stop();
    expect(subscribe.mock.results[0]?.value).toHaveBeenCalledOnce();
    expect(root.children).toHaveLength(0);
  });
  it('does not subscribe after disposal while the clock answer is pending', async () => {
    const subscribe = vi.fn(() => () => {});
    const api = fakeLlpApi({
      live: {clock: () => Promise.resolve(1000), subscribe},
    });
    const stop = startAudio({root: document.createElement('div'), api});
    stop();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(subscribe).not.toHaveBeenCalled();
  });
  it('logs clock failure and still follows output with the fallback clock', async () => {
    const write = vi.fn();
    const get = vi.fn(() => Promise.resolve(emptyLiveState()));
    const api = fakeLlpApi({
      live: {get, clock: () => Promise.reject(new Error('Clock unavailable'))},
      log: {write},
    });
    const stop = startAudio({root: document.createElement('div'), api});
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce());
    expect(write).toHaveBeenCalledOnce();
    stop();
  });
});
