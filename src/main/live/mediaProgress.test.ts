import {expect, it, vi} from 'vitest';
import {itemMedia, fixtureMedia} from '@core/testing/mediaList';
import {installMockClock} from '../../../test/mock-clock';
import {LiveStore} from './store';
import {startMediaProgress} from './mediaProgress';

it('contains a failed publication and still disposes its timer and listener', async () => {
  const clock = installMockClock();
  const store = new LiveStore(undefined, () => clock.now().getTime());
  store.connectAudioMedia(() => itemMedia().value);
  const publish = vi.fn().mockImplementationOnce(() => {
    throw new Error('Invented send failure');
  });
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  };
  const stop = startMediaProgress(store, publish, log);
  store.dispatch({
    type: 'media.show',
    media: {mediaId: fixtureMedia.dawn, loop: true},
  });
  expect(log.warn).toHaveBeenCalledOnce();
  await clock.advance(500);
  expect(publish).toHaveBeenCalledTimes(2);
  stop();
  expect(vi.getTimerCount()).toBe(0);
  expect(store.listenerCount).toBe(0);
});

it('samples main at two updates a second, ignores unrelated state and cleans up', async () => {
  const clock = installMockClock();
  const media = itemMedia().value;
  const store = new LiveStore(undefined, () => clock.now().getTime());
  store.connectAudioMedia(() => ({
    ...media,
    items: media.items.map(item => ({...item, duration: 3})),
  }));
  const publish = vi.fn();
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  };
  const stop = startMediaProgress(store, publish, log);
  expect(publish).not.toHaveBeenCalled();
  store.dispatch({
    type: 'media.show',
    media: {mediaId: fixtureMedia.dawn, loop: true},
  });
  expect(publish).toHaveBeenLastCalledWith(
    expect.objectContaining({positionSeconds: 0}),
  );
  await clock.advance(499);
  expect(publish).toHaveBeenCalledTimes(1);
  await clock.advance(1);
  expect(publish).toHaveBeenLastCalledWith(
    expect.objectContaining({positionSeconds: 0.5}),
  );
  store.dispatch({type: 'stage.message.set', text: 'Invented'});
  expect(publish).toHaveBeenCalledTimes(2);
  await clock.advance(2500);
  expect(publish).toHaveBeenLastCalledWith(
    expect.objectContaining({positionSeconds: 0}),
  );
  store.dispatch({type: 'layer.clear', target: 'media'});
  expect(publish).toHaveBeenLastCalledWith(null);
  expect(vi.getTimerCount()).toBe(0);
  stop();
  expect(store.listenerCount).toBe(0);
});
