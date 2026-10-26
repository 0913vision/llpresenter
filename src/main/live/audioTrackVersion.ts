import type {LiveState} from '@shared/live';

/** Allocates independently of the state version, which a batch compresses. */
export function nextAudioTrackVersion(state: LiveState): number {
  return (
    Math.max(
      state.audioTrackVersion ?? 0,
      state.layers.audio?.playback?.trackVersion ?? 0,
    ) + 1
  );
}
