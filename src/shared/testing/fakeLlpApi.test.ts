import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '../live';
import {fakeLlpApi} from './fakeLlpApi';

describe('fakeLlpApi', () => {
  it('answers reads with empty states and ignores sends', async () => {
    const api = fakeLlpApi();

    await expect(api.live.get()).resolves.toEqual(emptyLiveState());
    await expect(api.ui.get()).resolves.toEqual({});
    await expect(api.service.get()).resolves.toBeNull();
    expect(() => {
      api.service.subscribe(() => undefined)();
      api.log.write({level: 'info', message: 'ok'});
      api.output.reportFrameRate({screenId: 'main', fps: 60});
    }).not.toThrow();
  });

  it('uses the parts a test passes', () => {
    const control = vi.fn();

    fakeLlpApi({window: {control}}).window.control('close');

    expect(control).toHaveBeenCalledWith('close');
  });
});
