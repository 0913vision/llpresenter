import {describe, expect, it, vi} from 'vitest';
import {MAX_TARGET_SCREENS} from '@shared/schema/overlayState';
import type {SettingsReader} from '../store/settingsStore';
import {recordingLogger} from '../displays/testing';
import {MissingLiveTargetError} from '../live/commandErrors';
import {
  MAIN,
  STAGE,
  overlaySettings,
  settingsDocument,
} from '../live/testing/overlays';
import {createSettingsScreenSource} from './settingsScreens';
import {fullScreenScreen} from './testing';

const fallback = {list: () => [fullScreenScreen()]};

describe('saved output screens', () => {
  it('keeps saved screen kinds for output identification', async () => {
    const settings = overlaySettings();
    const source = createSettingsScreenSource(
      Promise.resolve(settings.reader),
      recordingLogger(),
      fallback,
    );
    await Promise.resolve();
    expect(source.list().find(screen => screen.id === MAIN)?.kind).toBe(
      'audience',
    );
    expect(source.list().find(screen => screen.id === STAGE)?.kind).toBe(
      'stage',
    );
    source.dispose();
  });
  it('discards a queued resync on dispose', async () => {
    const settings = overlaySettings();
    const source = createSettingsScreenSource(
      Promise.resolve(settings.reader),
      recordingLogger(),
      fallback,
    );
    await Promise.resolve();
    const changed = vi.fn();
    source.subscribe(changed);
    source.requireSaved(MAIN);
    source.queueRefresh();
    source.dispose();
    await Promise.resolve();
    expect(changed).not.toHaveBeenCalled();
    expect(settings.listeners.size).toBe(0);
    source.queueRefresh();
    await Promise.resolve();
    expect(changed).not.toHaveBeenCalled();
    expect(() => {
      source.requireSaved(MAIN);
    }).toThrow('Output settings are not ready');
  });

  it('checks a saved id without refreshing and coalesces queued refreshes', async () => {
    const settings = overlaySettings();
    const source = createSettingsScreenSource(
      Promise.resolve(settings.reader),
      recordingLogger(),
      fallback,
    );
    await Promise.resolve();
    settings.update(
      settingsDocument('screens', {
        screens: [
          {id: MAIN, name: 'Main', kind: 'audience', method: 'fullscreen'},
        ],
      }),
    );
    const changed = vi.fn();
    source.subscribe(changed);
    source.requireSaved(MAIN);
    expect(() => {
      source.requireSaved(STAGE);
    }).toThrow(MissingLiveTargetError);
    await Promise.resolve();
    expect(changed).not.toHaveBeenCalled();
    source.queueRefresh();
    source.queueRefresh();
    expect(changed).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(changed).toHaveBeenCalledOnce();
    source.dispose();
  });
  it('keeps the last good configuration on read failure and releases listeners', async () => {
    const settings = overlaySettings();
    const get = vi.fn(settings.reader.get);
    const log = recordingLogger();
    const source = createSettingsScreenSource(
      Promise.resolve({...settings.reader, get}),
      log,
      fallback,
    );
    const changed = vi.fn();
    const stop = source.subscribe(changed);
    expect(source.ready).toBe(false);
    await Promise.resolve();
    const previous = source.list();
    get.mockImplementation(() => {
      throw new Error('read failed');
    });
    settings.update(settingsDocument('screens', {screens: []}));
    expect(source.list()).toBe(previous);
    expect(log.messages('error')).toEqual([
      'could not read output screen settings',
    ]);
    stop();
    source.dispose();
    source.dispose();
    expect(settings.listeners.size).toBe(0);
    source.subscribe(changed);
    expect(source.list()).toEqual([]);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('caps the accepted screen list before notifying output consumers', async () => {
    const settings = overlaySettings();
    const document = settings.reader.get('screens');
    if (document.name !== 'screens') throw new Error('Missing screens');
    const reader = {
      ...settings.reader,
      get: () => ({
        ...document,
        value: {
          ...document.value,
          screens: Array.from(
            {length: MAX_TARGET_SCREENS + 1},
            () => document.value.screens[0],
          ).filter(screen => screen !== undefined),
        },
      }),
    };
    const log = recordingLogger();
    const source = createSettingsScreenSource(
      Promise.resolve(reader),
      log,
      fallback,
    );
    await Promise.resolve();
    expect(source.ready).toBe(true);
    expect(source.list()).toEqual([]);
    expect(log.messages('error')).toEqual([
      'could not read output screen settings',
    ]);
    source.dispose();
  });

  it('ignores startup that resolves after disposal', async () => {
    const settings = overlaySettings();
    let resolve: (reader: SettingsReader) => void = () => undefined;
    const pending = new Promise<SettingsReader>(done => {
      resolve = done;
    });
    const source = createSettingsScreenSource(
      pending,
      recordingLogger(),
      fallback,
    );
    source.dispose();
    resolve(settings.reader);
    await Promise.resolve();
    expect(settings.listeners.size).toBe(0);
  });

  it.each(['refused', 'failed'] as const)(
    'warns and uses defaults when the settings reader is %s',
    async reason => {
      const log = recordingLogger();
      const source = createSettingsScreenSource(
        reason === 'refused'
          ? Promise.resolve(null)
          : Promise.reject(new Error('load failed')),
        log,
        fallback,
      );
      await Promise.resolve();
      await Promise.resolve();
      expect(source.ready).toBe(true);
      expect(source.list()).toMatchObject([{id: 'main', method: 'fullscreen'}]);
      expect(log.messages('warn')).toEqual([
        'using built-in output screens because settings are unavailable',
      ]);
      source.dispose();
    },
  );
});
