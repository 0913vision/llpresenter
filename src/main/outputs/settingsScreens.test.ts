import {describe, expect, it, vi} from 'vitest';
import {MAX_TARGET_SCREENS} from '@shared/schema/overlayState';
import type {SettingsReader} from '../store/settingsStore';
import {recordingLogger} from '../displays/testing';
import {overlaySettings, settingsDocument} from '../live/testing/overlays';
import {createSettingsScreenSource} from './settingsScreens';

describe('saved output screens', () => {
  it('keeps the last good configuration on read failure and releases listeners', async () => {
    const settings = overlaySettings();
    const get = vi.fn(settings.reader.get);
    const log = recordingLogger();
    const source = createSettingsScreenSource(
      Promise.resolve({...settings.reader, get}),
      log,
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
    const source = createSettingsScreenSource(Promise.resolve(reader), log);
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
    const source = createSettingsScreenSource(pending, recordingLogger());
    source.dispose();
    resolve(settings.reader);
    await Promise.resolve();
    expect(settings.listeners.size).toBe(0);
  });

  it('reports an unavailable settings connection without leaving startup pending', async () => {
    const log = recordingLogger();
    const source = createSettingsScreenSource(
      Promise.reject(new Error('load failed')),
      log,
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(source.ready).toBe(true);
    expect(source.list()).toEqual([]);
    expect(log.messages('error')).toEqual([
      'could not connect output screen settings',
    ]);
    source.dispose();
  });
});
