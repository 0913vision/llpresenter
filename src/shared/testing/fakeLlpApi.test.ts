import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '../live';
import {fakeLlpApi} from './fakeLlpApi';

describe('fakeLlpApi', () => {
  it('answers reads with empty states and ignores sends', async () => {
    const api = fakeLlpApi();

    await expect(api.live.get()).resolves.toEqual(emptyLiveState());
    await expect(api.ui.get()).resolves.toEqual({});
    await expect(api.ui.getZoom()).resolves.toBe(100);
    await expect(api.ui.changeZoom({type: 'ui.zoomIn'})).resolves.toBe(100);
    await expect(api.service.get()).resolves.toBeNull();
    await expect(api.output.getStatus()).resolves.toEqual({});
    await expect(api.songs.list()).resolves.toEqual([]);
    await expect(api.services.get('a')).resolves.toBeNull();
    await expect(
      api.content.edit({type: 'song.create'}),
    ).resolves.toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    expect(() => {
      api.service.subscribe(() => undefined)();
      api.output.subscribeStatus(() => undefined)();
      api.output.retry('main');
      api.log.write({level: 'info', message: 'ok'});
      api.output.reportFrameRate({screenId: 'main', fps: 60});
    }).not.toThrow();
  });

  it('uses the parts a test passes', () => {
    const control = vi.fn();

    fakeLlpApi({window: {control}}).window.control('close');

    expect(control).toHaveBeenCalledWith('close');
  });

  it('keeps the defaults of a part that a test passes only partly', async () => {
    const reportFrameRate = vi.fn();

    const api = fakeLlpApi({output: {reportFrameRate}});
    api.output.reportFrameRate({screenId: 'main', fps: 60});

    expect(reportFrameRate).toHaveBeenCalledTimes(1);
    await expect(api.output.getStatus()).resolves.toEqual({});
  });
});
