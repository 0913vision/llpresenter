import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '../live';
import {fakeLlpApi} from './fakeLlpApi';
import {createAppFlushRequestId} from '../schema/ids';
import {createServiceId} from '../schema/ids';

describe('fakeLlpApi', () => {
  it('supplies flush defaults and supports a partial app override', () => {
    const requestId = createAppFlushRequestId(
      'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293',
    );
    const reply = {requestId, result: true};
    expect(() => {
      const api = fakeLlpApi();
      api.app.subscribeFlushRequests(() => undefined)();
      api.app.flushDone(reply);
      api.app.closeAnyway();
      api.problems.subscribe(() => undefined)();
      api.problems.retrySaves();
    }).not.toThrow();
    const flushDone = vi.fn();
    const api = fakeLlpApi({app: {flushDone}});
    api.app.subscribeFlushRequests(() => undefined)();
    api.app.flushDone(reply);
    expect(flushDone).toHaveBeenCalledExactlyOnceWith(reply);
  });
  it('answers reads with empty states and ignores sends', async () => {
    const api = fakeLlpApi();

    await expect(api.live.get()).resolves.toEqual(emptyLiveState());
    await expect(api.ui.get()).resolves.toEqual({});
    await expect(api.ui.getZoom()).resolves.toBe(100);
    await expect(api.ui.changeZoom({type: 'ui.zoomIn'})).resolves.toBe(100);
    await expect(api.service.get()).resolves.toBeNull();
    await expect(
      api.service.open({
        serviceId: createServiceId('00000000-0000-4000-8000-000000000001'),
      }),
    ).resolves.toBeNull();
    await expect(api.output.getStatus()).resolves.toEqual({});
    await expect(api.recovery.summary()).resolves.toBeNull();
    await expect(api.recovery.startFresh()).resolves.toEqual({
      ok: true,
      value: null,
    });
    await expect(
      api.recovery.apply({savedAt: '2026-10-25T12:00:00Z', rows: ['outputs']}),
    ).resolves.toMatchObject({ok: false, error: {reason: 'unavailable'}});
    await expect(api.songs.list()).resolves.toEqual([]);
    await expect(api.services.get('a')).resolves.toBeNull();
    await expect(api.preferences.get()).resolves.toMatchObject({
      show: {showClearUndoButton: false},
    });
    await expect(api.settings.get({name: 'labels'})).rejects.toThrow(
      'no settings documents',
    );
    await expect(
      api.settings.edit({
        type: 'settings.update',
        name: 'labels',
        value: {format: 'llsettings.labels', schemaVersion: 1, labels: []},
        baseRevision: 1,
      }),
    ).resolves.toMatchObject({ok: false, error: {reason: 'not-found'}});
    await expect(api.media.get()).resolves.toMatchObject({
      name: 'media',
      value: {items: []},
    });
    await expect(
      api.media.import({source: {kind: 'dialog'}, playlist: null}),
    ).resolves.toEqual({ok: true, value: []});
    await expect(api.library.search({query: '새', limit: 20})).resolves.toEqual(
      {query: '새', matches: []},
    );
    await expect(
      api.textImport.read({source: 'file', encoding: 'auto'}),
    ).resolves.toEqual({ok: true, value: null});
    await expect(
      api.textImport.preview({
        source: {source: 'clipboard', fileName: null, text: ''},
        options: {
          split: 'blankLine',
          unitsPerSlide: 1,
          labels: 'off',
          firstLine: 'lyrics',
        },
      }),
    ).resolves.toMatchObject({ok: false, error: {reason: 'empty'}});
    await expect(
      api.content.edit({type: 'song.create'}),
    ).resolves.toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    expect(() => {
      api.service.subscribe(() => undefined)();
      api.settings.subscribe(() => undefined)();
      api.preferences.subscribe(() => undefined)();
      api.media.subscribe(() => undefined)();
      api.media.subscribeImports(() => undefined)();
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
