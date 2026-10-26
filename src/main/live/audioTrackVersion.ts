import type {AudioLayer, LiveState} from '@shared/live';

/** Allocates independently of the state version, which a batch compresses. */
export function nextAudioTrackVersion(
  state: LiveState,
  restored: AudioLayer | null = state.layers.audio,
): number {
  return (
    Math.max(
      state.audioTrackVersion ?? 0,
      restored?.playback?.trackVersion ?? 0,
    ) + 1
  );
}
