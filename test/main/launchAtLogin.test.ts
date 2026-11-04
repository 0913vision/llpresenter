import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {defaultPreferences} from '@core/schema/preferences';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@core/schema/settingsDocuments';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {
  loginItemsAllowed,
  registerLaunchAtLogin,
  type LoginItems,
} from '@main/launchAtLogin';
import {SettingsStore} from '@main/store/settingsStore';

function preferencesDocument(launchAtLogin?: boolean): SettingsDocument {
  return {
    name: 'preferences',
    access: 'editable',
    revision: 1,
    value: {
      format: defaultPreferences.format,
      schemaVersion: 1,
      ...(launchAtLogin === undefined ? {} : {general: {launchAtLogin}}),
    },
  };
}

function setup({stored, windows}: {stored?: boolean; windows: boolean}) {
  const log = recordingLogger();
  const store = new SettingsStore({
    documents: new Map([['preferences', preferencesDocument(stored)]]),
    problems: [],
    log,
    saving: {
      folder: '/settings',
      files: {
        write: () => Promise.resolve({ok: true, value: undefined}),
        remove: () => Promise.resolve({ok: true, value: undefined}),
      },
    },
  });
  onTestFinished(() => store.dispose());
  const set = vi.fn<LoginItems['setLoginItemSettings']>();
  const get = vi.fn(() => ({openAtLogin: windows}));
  const loginItems: LoginItems = {
    getLoginItemSettings: get,
    setLoginItemSettings: set,
  };
  const applyEdit = vi.fn((edit: SettingsEdit) => store.apply(edit));
  const start = (enabled: boolean) =>
    registerLaunchAtLogin({
      settings: Promise.resolve(store),
      applyEdit: edit => applyEdit(edit),
      loginItems,
      enabled,
      log,
    });
  const change = async (launchAtLogin: boolean) => {
    const document = store.get('preferences');
    if (document.name !== 'preferences') throw new Error('Not preferences');
    return store.apply({
      type: 'settings.update',
      name: 'preferences',
      baseRevision: document.revision,
      value: {...document.value, general: {launchAtLogin}},
    });
  };
  return {store, set, get, log, start, change, applyEdit};
}

describe('loginItemsAllowed', () => {
  it('allows only a packaged build on Windows', () => {
    expect(loginItemsAllowed(true, 'win32')).toBe(true);
    expect(loginItemsAllowed(false, 'win32')).toBe(false);
    expect(loginItemsAllowed(true, 'darwin')).toBe(false);
    expect(loginItemsAllowed(false, 'linux')).toBe(false);
  });
});

describe('launch with Windows', () => {
  it('never reads or sets the Windows sign-in item when the run may not touch it', async () => {
    const {start, change, set, get, store} = setup({windows: false});
    const stop = start(false);
    await Promise.resolve();
    await change(true);
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(store.changeListenerCount).toBe(0);
    stop();
  });

  it('sets the Windows sign-in item at once when the preference changes, and only then', async () => {
    const {start, change, set, store} = setup({windows: false});
    const stop = start(true);
    await vi.waitFor(() => expect(store.changeListenerCount).toBe(1));
    expect(set).not.toHaveBeenCalled();
    await change(true);
    expect(set).toHaveBeenCalledExactlyOnceWith({openAtLogin: true});
    await change(true);
    expect(set).toHaveBeenCalledOnce();
    await change(false);
    expect(set).toHaveBeenLastCalledWith({openAtLogin: false});
    stop();
    expect(store.changeListenerCount).toBe(0);
  });

  it('takes the value Windows reports when the item was changed outside the app', async () => {
    const {start, store, set} = setup({stored: false, windows: true});
    const stop = start(true);
    await vi.waitFor(() =>
      expect(store.preferences().general.launchAtLogin).toBe(true),
    );
    await vi.waitFor(() => expect(store.changeListenerCount).toBe(1));
    expect(set).not.toHaveBeenCalled();
    stop();
  });

  it('writes nothing at launch when the file and Windows agree', async () => {
    const {start, store, set} = setup({stored: true, windows: true});
    const apply = vi.spyOn(store, 'apply');
    const stop = start(true);
    await vi.waitFor(() => expect(store.changeListenerCount).toBe(1));
    expect(apply).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    stop();
  });

  it('logs a refused Windows call and keeps following the preference', async () => {
    const {start, change, set, log, store} = setup({windows: false});
    set.mockImplementationOnce(() => {
      throw new Error('denied');
    });
    const stop = start(true);
    await vi.waitFor(() => expect(store.changeListenerCount).toBe(1));
    await change(true);
    expect(log.messages('error')).toHaveLength(1);
    await change(false);
    await change(true);
    expect(set).toHaveBeenCalledTimes(2);
    stop();
  });

  it('writes what Windows reports as a checked whole-file edit against the document revision', async () => {
    const {start, applyEdit, store} = setup({stored: false, windows: true});
    const stop = start(true);
    await vi.waitFor(() => expect(store.changeListenerCount).toBe(1));
    expect(applyEdit).toHaveBeenCalledOnce();
    expect(applyEdit.mock.calls[0]?.[0]).toMatchObject({
      type: 'settings.update',
      name: 'preferences',
      baseRevision: 1,
      value: {general: {launchAtLogin: true}},
    });
    stop();
  });

  it('logs a refused write of what Windows reports, does not undo Windows on a later unrelated change, and follows the checkbox', async () => {
    const {start, applyEdit, log, store, change, set} = setup({
      stored: false,
      windows: true,
    });
    applyEdit.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed'},
    });
    const stop = start(true);
    await vi.waitFor(() => expect(store.changeListenerCount).toBe(1));
    expect(log.messages('warn')).toHaveLength(1);
    await change(false);
    expect(set).not.toHaveBeenCalled();
    await change(true);
    expect(set).toHaveBeenCalledExactlyOnceWith({openAtLogin: true});
    await change(false);
    expect(set).toHaveBeenLastCalledWith({openAtLogin: false});
    stop();
  });

  it('logs a read of Windows that throws, takes the file as applied, and still follows a change', async () => {
    const {start, get, change, set, log, store, applyEdit} = setup({
      stored: false,
      windows: false,
    });
    get.mockImplementation(() => {
      throw new Error('denied');
    });
    const stop = start(true);
    await vi.waitFor(() => expect(store.changeListenerCount).toBe(1));
    expect(log.messages('error')).toHaveLength(1);
    expect(applyEdit).not.toHaveBeenCalled();
    await change(true);
    expect(set).toHaveBeenCalledExactlyOnceWith({openAtLogin: true});
    stop();
  });
});
