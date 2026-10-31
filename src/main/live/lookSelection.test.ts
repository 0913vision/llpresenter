import {settingsDocument} from '@core/testing/settingsDocument';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {parseLiveCommand} from '@core/schema/liveCommand';
import type {LookSelectionPort} from '../store/lookSelection';
import {recordingLogger} from '../displays/testing';
import {registerLookSelection} from './lookSelection';
import {dispatchLogged, LiveStore} from './store';
import {overlaySettings} from '@core/testing/overlays';

function command(id: number) {
  const parsed = parseLiveCommand({
    type: 'look.set',
    lookId: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  });
  if (!parsed.ok || parsed.value.type !== 'look.set') {
    throw new Error('Invalid Look fixture');
  }
  return parsed.value;
}
const FIRST = command(10);
const SECOND = command(11);
const MISSING = command(12);

function setup() {
  const store = new LiveStore(undefined, () => 1000);
  const settings = overlaySettings();
  settings.update(
    settingsDocument('looks', {
      current: FIRST.lookId,
      looks: [
        {id: FIRST.lookId, name: 'First', screens: {}},
        {id: SECOND.lookId, name: 'Second', screens: {}},
      ],
      lyricStyles: [],
    }),
  );
  const release = store.connectSettings(settings.reader);
  const selectLook = vi
    .fn<LookSelectionPort['selectLook']>()
    .mockResolvedValue({
      ok: true,
      value: {id: 'looks', revision: 2},
    });
  const log = recordingLogger();
  const stop = registerLookSelection({store, selection: {selectLook}, log});
  onTestFinished(() => {
    stop();
    release();
  });
  return {store, settings, selectLook, log, stop, release};
}

describe('Look state and saved selection lifecycle', () => {
  it('publishes the selected Look to every subscriber before its save settles', async () => {
    const {store, selectLook} = setup();
    let complete: () => void = () => undefined;
    selectLook.mockReturnValueOnce(
      new Promise(resolve => {
        complete = () => resolve({ok: true, value: {id: 'looks', revision: 2}});
      }),
    );
    const listeners = [vi.fn(), vi.fn(), vi.fn()];
    for (const listener of listeners) onTestFinished(store.subscribe(listener));
    try {
      expect(store.dispatch(SECOND)).toBe(true);
      expect(store.state.lookId).toBe(SECOND.lookId);
      for (const listener of listeners) {
        expect(listener).toHaveBeenCalledExactlyOnceWith(store.state);
      }
      expect(selectLook).toHaveBeenCalledExactlyOnceWith(SECOND.lookId);
      expect(store.state.version).toBe(1);
    } finally {
      complete();
    }
    await Promise.resolve();
  });

  it('persists only the final Look of a batch and leaves content and clear undo intact', () => {
    const {store, selectLook} = setup();
    store.dispatch({
      type: 'message.show',
      message: {messageId: 'fixture', text: 'Fixture'},
    });
    store.dispatch({type: 'layer.clear', target: 'message'});
    const layers = store.state.layers;
    const listener = vi.fn();
    onTestFinished(store.subscribe(listener));
    store.dispatch({type: 'live.batch', commands: [SECOND, FIRST, SECOND]});
    expect(store.state.layers).toBe(layers);
    expect(store.state.canUndo).toBe(true);
    expect(listener).toHaveBeenCalledExactlyOnceWith(store.state);
    expect(selectLook).toHaveBeenCalledExactlyOnceWith(SECOND.lookId);
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers.message?.text).toBe('Fixture');
    expect(store.state.lookId).toBe(SECOND.lookId);
    expect(selectLook).toHaveBeenCalledOnce();
  });

  it('ignores a repeated effective selection and skips a deleted Look while the batch continues', () => {
    const {store, selectLook, log} = setup();
    expect(store.dispatch(FIRST)).toBe(false);
    expect(selectLook).not.toHaveBeenCalled();
    dispatchLogged(
      store,
      {
        type: 'live.batch',
        commands: [
          MISSING,
          SECOND,
          {type: 'output.set', screenId: 'main', on: true},
        ],
      },
      log,
    );
    expect(store.state.lookId).toBe(SECOND.lookId);
    expect(store.state.outputs['main']).toBe(true);
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]).toMatchObject({
      level: 'warn',
      detail: {
        reason: 'missing-target',
        target: {kind: 'look', id: MISSING.lookId},
      },
    });
    expect(store.dispatch(SECOND)).toBe(false);
    expect(selectLook).toHaveBeenCalledOnce();
  });

  it('warns about a refused save without rolling back live output, and releases its listener', async () => {
    const {store, selectLook, log, stop} = setup();
    selectLook.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'read-only', message: 'The Look settings are read-only'},
    });
    store.dispatch(SECOND);
    await Promise.resolve();
    expect(store.state.lookId).toBe(SECOND.lookId);
    expect(log.messages('warn')).toEqual(['could not save the selected Look']);
    expect(store.listenerCount).toBe(1);
    stop();
    stop();
    expect(store.listenerCount).toBe(0);
    store.dispatch(FIRST);
    expect(selectLook).toHaveBeenCalledOnce();
  });

  it('leaves a failed write to the settings persistence log', async () => {
    const {store, selectLook, log} = setup();
    selectLook.mockResolvedValueOnce({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'disk full',
        applied: {id: 'looks', revision: 2},
        unchangedFiles: ['/settings/looks.json'],
      },
    });
    store.dispatch(SECOND);
    await Promise.resolve();
    await Promise.resolve();
    expect(store.state.lookId).toBe(SECOND.lookId);
    expect(log.entries).toEqual([]);
  });

  it('skips a Look change before the settings connect, alone and in a batch', () => {
    const store = new LiveStore(undefined, () => 1000);
    const log = recordingLogger();
    dispatchLogged(store, SECOND, log);
    expect(store.state.version).toBe(0);
    dispatchLogged(
      store,
      {
        type: 'live.batch',
        commands: [SECOND, {type: 'output.set', screenId: 'main', on: true}],
      },
      log,
    );
    expect(store.state).toMatchObject({version: 1, outputs: {main: true}});
    expect(store.state.lookId).toBeUndefined();
    expect(log.messages('error')).toEqual([
      'live command failed',
      'live command failed',
    ]);
  });

  it('replaces a deleted live Look with the next choice and refuses the deleted one', () => {
    const {store, settings} = setup();
    store.dispatch(SECOND);
    settings.update(
      settingsDocument(
        'looks',
        {
          current: FIRST.lookId,
          looks: [{id: FIRST.lookId, name: 'First', screens: {}}],
          lyricStyles: [],
        },
        2,
      ),
    );
    expect(store.dispatch(FIRST)).toBe(true);
    expect(store.state.lookId).toBe(FIRST.lookId);
    const skipped = vi.fn();
    expect(store.dispatch(SECOND, undefined, skipped)).toBe(false);
    expect(skipped).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'missing-target'}),
    );
    expect(store.state.lookId).toBe(FIRST.lookId);
  });

  it('logs an unexpected writer exception and skips persistence after shutdown', async () => {
    const {store, selectLook, log, stop, release} = setup();
    selectLook.mockRejectedValueOnce(new Error('Writer unavailable'));
    store.dispatch(SECOND);
    await vi.waitFor(
      () => {
        expect(log.messages('error')).toEqual(['Look selection writer failed']);
      },
      {interval: 1},
    );
    stop();
    release();
    const before = store.state;
    dispatchLogged(store, FIRST, log);
    expect(store.state).toBe(before);
    expect(selectLook).toHaveBeenCalledOnce();
  });
});
