import {expect, it, vi} from 'vitest';
import {forwardingHandle} from '@main/outputs/ndi/forwardingHandle';
import {fullScreenScreen, mockWindows} from '@fixtures/main/outputs/testing';

const BOUNDS = {x: 0, y: 0, width: 1920, height: 1080};

it('passes each call to the handle behind it now, so a swap takes the calls after it', async () => {
  const windows = mockWindows();
  const events = {onRendererGone: vi.fn(), onCloseRequested: vi.fn()};
  windows.create(fullScreenScreen({id: 'ndi'}), events);
  windows.create(fullScreenScreen({id: 'ndi'}), events);
  const [bitmap, gpu] = windows.created;
  if (bitmap === undefined || gpu === undefined) throw new Error('No handles');
  let behind = bitmap;
  const handle = forwardingHandle(() => behind);

  handle.showFullScreen(BOUNDS, true);
  await handle.ping();
  await handle.reload();
  expect(bitmap.mode).toEqual({
    kind: 'fullscreen',
    bounds: BOUNDS,
    alwaysOnTop: true,
  });
  expect(bitmap.pings).toBe(1);
  expect(bitmap.reloads).toBe(1);

  behind = gpu;
  handle.showWindowed(BOUNDS, false);
  handle.bringToFront();
  handle.requestFrame();
  handle.prepareForMonitorRemoval();
  handle.crashRenderer();
  expect(gpu.mode).toEqual({kind: 'window', bounds: BOUNDS});
  handle.hide();
  handle.destroy();
  expect(gpu.mode).toEqual({kind: 'hidden'});
  expect(gpu.raises).toBe(1);
  expect(gpu.frameRequests).toBe(1);
  expect(gpu.monitorRemovals).toBe(1);
  expect(gpu.forcedCrashes).toBe(1);
  expect(gpu.destroyed).toBe(true);
  expect(bitmap.destroyed).toBe(false);
  expect(handle.bounds()).toEqual(gpu.bounds());
  expect(handle.contentSize()).toEqual(gpu.contentSize());
  expect(handle.previewContents?.()).toBeNull();
});
