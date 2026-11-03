import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {
  applySink,
  followAudioOutput,
  listAudioOutputs,
} from '@renderer/rendering/audioSink';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

class FakeDevices extends EventTarget {
  list: Array<{kind: string; deviceId: string; label: string}> = [];
  enumerateDevices = vi.fn(() => Promise.resolve(this.list));
}

let devices: FakeDevices;

beforeEach(() => {
  devices = new FakeDevices();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: devices,
  });
});
afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

function sinkable() {
  const element = document.createElement('audio');
  const setSinkId = vi.fn(() => Promise.resolve());
  Object.defineProperty(element, 'setSinkId', {value: setSinkId});
  return {element, setSinkId};
}

const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('applySink', () => {
  it('leaves a new element on the Windows default without a call', () => {
    const {element, setSinkId} = sinkable();
    applySink(element, '', vi.fn());
    expect(setSinkId).not.toHaveBeenCalled();
  });

  it('sets a device once, again when it changes, and back to the default', async () => {
    const {element, setSinkId} = sinkable();
    applySink(element, 'hall', vi.fn());
    await settle();
    applySink(element, 'hall', vi.fn());
    applySink(element, 'phones', vi.fn());
    await settle();
    applySink(element, '', vi.fn());
    await settle();
    expect(setSinkId.mock.calls).toEqual([['hall'], ['phones'], ['']]);
  });

  it('keeps the device the element really is on when a switch is refused', async () => {
    const {element, setSinkId} = sinkable();
    const onError = vi.fn();
    applySink(element, 'hall', onError);
    await settle();
    setSinkId.mockRejectedValueOnce(new Error('NotFoundError'));
    applySink(element, 'gone', onError);
    await settle();
    expect(onError).toHaveBeenCalledOnce();
    applySink(element, '', onError);
    await settle();
    expect(setSinkId.mock.calls).toEqual([['hall'], ['gone'], ['']]);
    applySink(element, '', onError);
    await settle();
    expect(setSinkId).toHaveBeenCalledTimes(3);
  });

  it('plays the last request when an earlier call is still in flight', async () => {
    const {element, setSinkId} = sinkable();
    let finish: () => void = () => undefined;
    setSinkId.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    applySink(element, 'hall', vi.fn());
    applySink(element, '', vi.fn());
    expect(setSinkId.mock.calls).toEqual([['hall']]);
    finish();
    await settle();
    expect(setSinkId.mock.calls).toEqual([['hall'], ['']]);
    applySink(element, '', vi.fn());
    await settle();
    expect(setSinkId).toHaveBeenCalledTimes(2);
  });

  it('reports a device the element refuses and tries it again next time', async () => {
    const {element, setSinkId} = sinkable();
    setSinkId.mockRejectedValueOnce(new Error('NotFoundError'));
    const onError = vi.fn();
    applySink(element, 'gone', onError);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    applySink(element, 'gone', onError);
    await settle();
    expect(setSinkId).toHaveBeenCalledTimes(2);
  });

  it('does nothing where an element has no setSinkId', () => {
    expect(() =>
      applySink(document.createElement('audio'), 'hall', vi.fn()),
    ).not.toThrow();
  });
});

describe('listAudioOutputs', () => {
  it('lists output devices only and leaves the browser default entries out', async () => {
    devices.list = [
      {kind: 'audiooutput', deviceId: 'default', label: 'Default - Mixer'},
      {kind: 'audiooutput', deviceId: 'communications', label: 'Comms'},
      {kind: 'audiooutput', deviceId: 'hall', label: 'Mixer'},
      {kind: 'audioinput', deviceId: 'mic', label: 'Mic'},
    ];
    expect(await listAudioOutputs()).toEqual([{id: 'hall', label: 'Mixer'}]);
  });
});

describe('followAudioOutput', () => {
  function setup(media?: object) {
    let revision = 1;
    const listeners = new Set<(document: SettingsDocument) => void>();
    const document = (value: object): SettingsDocument => ({
      name: 'preferences',
      value: {format: 'llsettings.preferences', schemaVersion: 1, ...value},
      revision: revision++,
      access: 'editable',
    });
    const api = mockLlpApi({
      settings: {
        get: () =>
          Promise.resolve(document(media === undefined ? {} : {media})),
        subscribe: listener => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    });
    const apply = vi.fn();
    const stop = followAudioOutput({
      settings: api.settings,
      pick: 'audioOutput',
      apply,
      onError: vi.fn(),
    });
    return {
      apply,
      stop,
      push: (value: object) => {
        for (const listener of listeners) listener(document(value));
      },
    };
  }

  it('plays to the Windows default when nothing is saved', async () => {
    const {apply, stop} = setup();
    await vi.waitFor(() => expect(apply).toHaveBeenCalledOnce());
    expect(apply).toHaveBeenCalledWith({sinkId: '', missing: false});
    stop();
  });

  it('plays to a saved device that is connected', async () => {
    devices.list = [{kind: 'audiooutput', deviceId: 'hall', label: 'Mixer'}];
    const {apply, stop} = setup({audioOutput: {id: 'hall', label: 'Mixer'}});
    await vi.waitFor(() =>
      expect(apply).toHaveBeenCalledWith({sinkId: 'hall', missing: false}),
    );
    stop();
  });

  it('falls back to the default for a device that is not connected and keeps it saved', async () => {
    const {apply, stop} = setup({
      audioOutput: {id: 'gone', label: 'Unplugged'},
    });
    await vi.waitFor(() =>
      expect(apply).toHaveBeenCalledWith({sinkId: '', missing: true}),
    );
    devices.list = [
      {kind: 'audiooutput', deviceId: 'gone', label: 'Unplugged'},
    ];
    devices.dispatchEvent(new Event('devicechange'));
    await vi.waitFor(() =>
      expect(apply).toHaveBeenLastCalledWith({sinkId: 'gone', missing: false}),
    );
    devices.list = [];
    devices.dispatchEvent(new Event('devicechange'));
    await vi.waitFor(() =>
      expect(apply).toHaveBeenLastCalledWith({sinkId: '', missing: true}),
    );
    stop();
  });

  it('applies again at once when the setting changes, and not for an unchanged choice', async () => {
    devices.list = [
      {kind: 'audiooutput', deviceId: 'hall', label: 'Mixer'},
      {kind: 'audiooutput', deviceId: 'phones', label: 'Headphones'},
    ];
    const {apply, push, stop} = setup({
      audioOutput: {id: 'hall', label: 'Mixer'},
    });
    await vi.waitFor(() => expect(apply).toHaveBeenCalledOnce());
    push({media: {audioOutput: {id: 'hall', label: 'Mixer'}}});
    await vi.waitFor(() =>
      expect(devices.enumerateDevices).toHaveBeenCalledTimes(2),
    );
    expect(apply).toHaveBeenCalledOnce();
    push({media: {audioOutput: {id: 'phones', label: 'Headphones'}}});
    await vi.waitFor(() =>
      expect(apply).toHaveBeenLastCalledWith({
        sinkId: 'phones',
        missing: false,
      }),
    );
    stop();
  });

  it('stops following the settings and the devices', async () => {
    const {apply, stop} = setup();
    await vi.waitFor(() => expect(apply).toHaveBeenCalledOnce());
    stop();
    devices.list = [{kind: 'audiooutput', deviceId: 'hall', label: 'Mixer'}];
    devices.dispatchEvent(new Event('devicechange'));
    await Promise.resolve();
    expect(apply).toHaveBeenCalledOnce();
  });
});
