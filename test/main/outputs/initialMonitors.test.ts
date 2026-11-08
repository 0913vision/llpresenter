import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Screen} from '@core/schema/screens';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@core/schema/settingsDocuments';
import type {SettingsReader} from '@core/schema/settingsReader';
import {defaultPreferences} from '@core/schema/preferences';
import {
  MAIN_SCREEN,
  STAGE_SCREEN,
  BROADCAST_SCREEN,
} from '@fixtures/core/screenIds';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {findControlMonitor, type Monitor} from '@main/displays/monitor';
import {assignInitialMonitors} from '@main/outputs/initialMonitors';

vi.mock('@main/displays/monitor', () => ({findControlMonitor: vi.fn()}));

function monitor(id: number): Monitor {
  return {
    id,
    name: `Monitor ${id}`,
    number: id,
    primary: id === 1,
    bounds: {x: (id - 1) * 1920, y: 0, width: 1920, height: 1080},
    workArea: {x: (id - 1) * 1920, y: 0, width: 1920, height: 1040},
    scaleFactor: 1,
    refreshRate: 60,
  };
}

const control = monitor(1);
const second = monitor(2);
const third = monitor(3);
const audience: Screen = {
  id: MAIN_SCREEN,
  name: 'Audience',
  kind: 'audience',
  method: 'fullscreen',
};
const stage: Screen = {
  id: STAGE_SCREEN,
  name: 'Stage',
  kind: 'stage',
  method: 'fullscreen',
};
const broadcast: Screen = {
  id: BROADCAST_SCREEN,
  name: 'Broadcast',
  kind: 'broadcast',
  method: 'capture',
};
const saved = {
  id: 99,
  name: 'Missing',
  number: 4,
  bounds: third.bounds,
  scaleFactor: 1,
};

function fixture(screens: readonly Screen[] = [audience, broadcast, stage]) {
  let document: SettingsDocument = {
    name: 'screens',
    revision: 7,
    access: 'editable',
    value: {format: 'llsettings.screens', schemaVersion: 1, screens},
  };
  const reader: SettingsReader = {
    get: vi.fn(() => document),
    preferences: () => defaultPreferences,
    subscribe: vi.fn(() => () => undefined),
  };
  const listeners = new Set<() => void>();
  const displays = {
    monitors: [control, second, third],
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const save = vi.fn(async (edit: SettingsEdit) => {
    if (edit.type !== 'settings.update' || edit.name !== 'screens') {
      throw new Error('Unexpected edit');
    }
    document = {
      ...document,
      name: 'screens',
      value: edit.value,
      revision: document.revision + 1,
    };
    return {
      ok: true as const,
      value: {id: 'screens', revision: document.revision},
    };
  });
  const log = recordingLogger();
  const bounds = vi.fn(() => control.bounds);
  const options = {
    settings: Promise.resolve(reader),
    displays,
    controlBounds: bounds,
    save,
    log,
  };
  return {
    reader,
    displays,
    listeners,
    save,
    log,
    options,
    change: () => {
      for (const listener of listeners) listener();
    },
    readOnly: () => {
      document = {...document, access: 'readOnly'};
    },
  };
}

async function loaded(): Promise<void> {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

beforeEach(() => vi.mocked(findControlMonitor).mockReturnValue(control));

describe('initial saved monitor assignment', () => {
  it('saves discovered identity once the background query finishes', async () => {
    const f = fixture();
    f.displays.monitors = [
      {...control, identityPending: true},
      {...second, identityPending: true},
    ];
    const stop = assignInitialMonitors(f.options);
    await loaded();
    expect(f.save).not.toHaveBeenCalled();
    const identity = {
      kind: 'windows',
      devicePath: 'path',
      edid: {manufacturer: 'DEL', product: '1234', serial: 'PANEL123'},
    } as const;
    f.displays.monitors = [control, {...second, identity}];
    f.change();
    await loaded();
    expect(f.save).toHaveBeenCalledOnce();
    const document = f.reader.get('screens');
    expect(
      document.name === 'screens' &&
        document.value.screens[0]?.display?.identity,
    ).toEqual(identity);
    stop();
  });
  it('saves audience on the second monitor and stage on the third without changing broadcast', async () => {
    const f = fixture();
    const stop = assignInitialMonitors(f.options);
    await loaded();
    expect(f.save).toHaveBeenCalledExactlyOnceWith({
      type: 'settings.update',
      name: 'screens',
      baseRevision: 7,
      value: {
        format: 'llsettings.screens',
        schemaVersion: 1,
        screens: [
          {
            ...audience,
            display: {
              id: 2,
              name: second.name,
              number: 2,
              bounds: second.bounds,
              scaleFactor: 1,
            },
          },
          broadcast,
          {
            ...stage,
            display: {
              id: 3,
              name: third.name,
              number: 3,
              bounds: third.bounds,
              scaleFactor: 1,
            },
          },
        ],
      },
    });
    expect(findControlMonitor).toHaveBeenCalledWith(
      f.displays.monitors,
      control.bounds,
    );
    expect(f.log.entries).toEqual([]);
    f.change();
    await loaded();
    expect(f.save).toHaveBeenCalledTimes(1);
    stop();
    expect(f.listeners.size).toBe(0);
  });

  it('uses the actual control monitor instead of assuming the primary monitor', async () => {
    const f = fixture();
    vi.mocked(findControlMonitor).mockReturnValue(second);
    f.options.controlBounds.mockReturnValue(second.bounds);
    const stop = assignInitialMonitors(f.options);
    await loaded();
    const doc = f.reader.get('screens');
    expect(doc.name === 'screens' && doc.value.screens[0]?.display?.id).toBe(1);
    expect(doc.name === 'screens' && doc.value.screens[2]?.display?.id).toBe(3);
    stop();
  });

  it('assigns only audience with two monitors and does not later move it to fill stage', async () => {
    const f = fixture();
    f.displays.monitors = [control, second];
    const stop = assignInitialMonitors(f.options);
    await loaded();
    const doc = f.reader.get('screens');
    expect(
      doc.name === 'screens' && doc.value.screens[2]?.display,
    ).toBeUndefined();
    f.displays.monitors = [control, second, third];
    f.change();
    await loaded();
    expect(f.save).toHaveBeenCalledTimes(1);
    stop();
  });

  it('waits for a hot plug when launch has only the control monitor', async () => {
    const f = fixture();
    f.displays.monitors = [control];
    const stop = assignInitialMonitors(f.options);
    await loaded();
    expect(f.save).not.toHaveBeenCalled();
    f.displays.monitors = [control, second];
    f.change();
    await loaded();
    expect(f.save).toHaveBeenCalledTimes(1);
    stop();
  });

  it.each(['audience', 'stage', 'broadcast'] as const)(
    'keeps every saved choice when %s has an assignment, including a missing monitor',
    async kind => {
      const f = fixture(
        [audience, broadcast, stage].map(s =>
          s.kind === kind ? {...s, display: saved} : s,
        ),
      );
      const stop = assignInitialMonitors(f.options);
      await loaded();
      f.change();
      await loaded();
      expect(f.save).not.toHaveBeenCalled();
      stop();
    },
  );

  it.each(['window', 'capture', 'ndi'] as const)(
    'preserves an operator-selected %s audience method',
    async method => {
      const f = fixture([{...audience, method}, broadcast]);
      const stop = assignInitialMonitors(f.options);
      await loaded();
      expect(f.save).not.toHaveBeenCalled();
      stop();
    },
  );

  it('skips read-only settings and releases a late startup read after stop', async () => {
    const f = fixture();
    f.readOnly();
    let resolve: (reader: SettingsReader) => void = () => undefined;
    const settings = new Promise<SettingsReader>(done => {
      resolve = done;
    });
    const stop = assignInitialMonitors({...f.options, settings});
    stop();
    resolve(f.reader);
    await loaded();
    expect(f.save).not.toHaveBeenCalled();
    expect(f.listeners.size).toBe(0);
    const stopReadOnly = assignInitialMonitors(f.options);
    await loaded();
    expect(f.save).not.toHaveBeenCalled();
    stopReadOnly();
  });

  it('logs rejected saves and read failures without unhandled rejections', async () => {
    const f = fixture();
    f.save.mockRejectedValueOnce(new Error('Disk failed'));
    const stop = assignInitialMonitors(f.options);
    await loaded();
    expect(f.log.messages('error')).toContain(
      'could not assign initial screen monitors',
    );
    f.reader.get = vi.fn(() => {
      throw new Error('Read failed');
    });
    f.change();
    await loaded();
    expect(f.log.messages('error')).toHaveLength(2);
    stop();
  });
});
