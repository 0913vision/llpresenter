import type {PreferencesFile} from '../schema/preferences';

/** An audio output device as the browser lists it. */
export interface AudioDevice {
  readonly id: string;
  readonly label: string;
}

/** A saved audio device choice: an empty id is the Windows default. */
export type AudioChoice = NonNullable<
  NonNullable<PreferencesFile['media']>['audioOutput']
>;

/** What to play to: the sink id for `setSinkId`, and whether the choice is missing. */
export interface ResolvedSink {
  /** The device id to play to; an empty id is the Windows default device. */
  readonly sinkId: string;
  /** True when a saved device is not connected and the default plays instead. */
  readonly missing: boolean;
}

/**
 * Finds the device a saved choice names among the connected ones: by id, then
 * by label. A device that is not connected plays to the Windows default; the
 * saved choice itself stays, so it comes back when the device returns.
 */
export function resolveAudioSink(
  choice: AudioChoice | undefined,
  devices: readonly AudioDevice[],
): ResolvedSink {
  if (choice === undefined || choice.id === '') {
    return {sinkId: '', missing: false};
  }
  const byId = devices.find(device => device.id === choice.id);
  if (byId !== undefined) return {sinkId: byId.id, missing: false};
  const byLabel =
    choice.label === ''
      ? undefined
      : devices.find(device => device.label === choice.label);
  if (byLabel !== undefined) return {sinkId: byLabel.id, missing: false};
  return {sinkId: '', missing: true};
}
