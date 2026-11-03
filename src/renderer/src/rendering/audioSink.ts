import type {LlpApi} from '@contracts/ipc/api';
import {
  resolveAudioSink,
  type AudioChoice,
  type AudioDevice,
  type ResolvedSink,
} from '@core/media/audioOutput';

interface SinkState {
  /** The device the element has taken; the Windows default at the start. */
  confirmed: string;
  /** The device the last request asked for. */
  wanted: string;
  /** A `setSinkId` call has not settled yet. */
  pending: boolean;
}

const states = new WeakMap<HTMLMediaElement, SinkState>();

/**
 * Plays an element's sound to a device (`setSinkId`). An empty id is the
 * Windows default. An element already on that device is left alone. The
 * device is recorded only once the element has taken it, so a refused device
 * leaves the element, and what is known of it, on the device it was on.
 */
export function applySink(
  element: HTMLMediaElement,
  sinkId: string,
  onError: (message: string, error: unknown) => void,
): void {
  const state = states.get(element) ?? {
    confirmed: '',
    wanted: '',
    pending: false,
  };
  states.set(element, state);
  state.wanted = sinkId;
  // NOTE(0913vision): While a call is out, the call that settles looks at
  // `wanted` again, so the last request always wins.
  if (!state.pending) change(element, state, onError);
}

function change(
  element: HTMLMediaElement,
  state: SinkState,
  onError: (message: string, error: unknown) => void,
): void {
  // NOTE(0913vision): An element starts on the Windows default, which needs
  // no call.
  if (state.wanted === state.confirmed) return;
  if (typeof element.setSinkId !== 'function') return;
  const target = state.wanted;
  state.pending = true;
  const settled = (): void => {
    state.pending = false;
    if (state.wanted !== target) change(element, state, onError);
  };
  element.setSinkId(target).then(
    () => {
      state.confirmed = target;
      settled();
    },
    (error: unknown) => {
      onError('could not choose the audio output device', error);
      settled();
    },
  );
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
