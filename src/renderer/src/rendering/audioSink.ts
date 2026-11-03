import type {LlpApi} from '@contracts/ipc/api';
import {
  resolveAudioSink,
  type AudioChoice,
  type AudioDevice,
  type ResolvedSink,
} from '@core/media/audioOutput';

const applied = new WeakMap<HTMLMediaElement, string>();

/**
 * Plays an element's sound to a device (`setSinkId`). An empty id is the
 * Windows default. An element already on that device is left alone; a device
 * the element refuses falls back to the default and reports the error.
 */
export function applySink(
  element: HTMLMediaElement,
  sinkId: string,
  onError: (message: string, error: unknown) => void,
): void {
  // NOTE(0913vision): An element starts on the Windows default, which needs
  // no call.
  if ((applied.get(element) ?? '') === sinkId) return;
  if (typeof element.setSinkId !== 'function') return;
  applied.set(element, sinkId);
  element.setSinkId(sinkId).catch((error: unknown) => {
    applied.delete(element);
    onError('could not choose the audio output device', error);
  });
}

/** The browser's device list, or null where a page has none (a test page). */
export function deviceApi(): MediaDevices | null {
  return 'mediaDevices' in navigator ? navigator.mediaDevices : null;
}

const VIRTUAL_DEVICE_IDS = new Set(['default', 'communications']);

/** The connected audio output devices; the browser's own default entries are left out. */
export async function listAudioOutputs(): Promise<readonly AudioDevice[]> {
  const devices = deviceApi();
  if (devices === null) return [];
  const found = await devices.enumerateDevices();
  return found
    .filter(
      device =>
        device.kind === 'audiooutput' &&
        !VIRTUAL_DEVICE_IDS.has(device.deviceId),
    )
    .map(device => ({id: device.deviceId, label: device.label}));
}

interface FollowOptions {
  readonly settings: LlpApi['settings'];
  readonly pick: 'audioOutput' | 'previewOutput';
  readonly apply: (sink: ResolvedSink) => void;
  readonly onError: (message: string, error: unknown) => void;
  /** The connected devices; the renderer's device list when absent. */
  readonly devices?: () => Promise<readonly AudioDevice[]>;
}

/**
 * Follows a saved audio device choice of 환경설정 and the connected devices,
 * and hands the sink to play to over each time either changes. The saved
 * choice is never rewritten: a device that is not connected plays to the
 * Windows default and comes back when it returns.
 *
 * @returns A function that stops following.
 */
export function followAudioOutput(options: FollowOptions): () => void {
  const list = options.devices ?? listAudioOutputs;
  let choice: AudioChoice | undefined;
  let stopped = false;
  let last: ResolvedSink | undefined;
  let round = 0;
  const refresh = (): void => {
    const mine = ++round;
    list()
      .then(devices => {
        if (stopped || mine !== round) return;
        const sink = resolveAudioSink(choice, devices);
        if (last?.sinkId === sink.sinkId && last.missing === sink.missing) {
          return;
        }
        last = sink;
        options.apply(sink);
      })
      .catch((error: unknown) =>
        options.onError('could not list the audio output devices', error),
      );
  };
  let revision = -1;
  const receive = (document: {
    readonly name: string;
    readonly revision: number;
    readonly value: unknown;
  }): void => {
    if (stopped || document.revision < revision) return;
    revision = document.revision;
    choice = pickChoice(document, options.pick);
    refresh();
  };
  const unsubscribe = options.settings.subscribe(receive);
  options.settings
    .get({name: 'preferences'})
    .then(receive)
    .catch((error: unknown) =>
      options.onError('could not read the audio output choice', error),
    );
  deviceApi()?.addEventListener('devicechange', refresh);
  return () => {
    stopped = true;
    unsubscribe();
    deviceApi()?.removeEventListener('devicechange', refresh);
  };
}

function field(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return Object.entries(value).find(([name]) => name === key)?.[1];
}

function pickChoice(
  document: {readonly name: string; readonly value: unknown},
  pick: FollowOptions['pick'],
): AudioChoice | undefined {
  if (document.name !== 'preferences') return undefined;
  const chosen = field(field(document.value, 'media'), pick);
  const id = field(chosen, 'id');
  const label = field(chosen, 'label');
  return typeof id === 'string' && typeof label === 'string'
    ? {id, label}
    : undefined;
}
