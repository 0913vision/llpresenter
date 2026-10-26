import type {AudioLayer, LiveState} from '@shared/live';
import {mediaUrl} from '@shared/media';
import {
  AUDIO_MANUAL_FADE_MS,
  audioPositionSeconds,
} from '@shared/schema/audioState';
import {fadeAudio} from './audioFade';

/** Leaves time for command delivery within the F5 half-second limit. */
export const AUDIO_CLEAR_FADE_MS = 400;

interface AudioPlayerOptions {
  readonly now: () => number;
  readonly onNext: (trackVersion: number) => void;
  readonly onFadeEnd: (trackVersion: number, since: number) => void;
  readonly onError: (message: string, error: unknown) => void;
  readonly muted?: boolean;
}

interface Track {
  readonly element: HTMLAudioElement;
  layer: AudioLayer | null;
  ready: boolean;
  attempted: boolean;
  generation: number;
}

interface ManualFade {
  readonly trackVersion: number;
  readonly since: number;
  done: boolean;
}

const MAX_REPORTED_AUDIO_ERRORS = 32;

/** One audio owner, with a spare decoder that preserves the playing track on load failure. */
export class AudioPlayer {
  private readonly tracks: readonly Track[];
  private readonly releases: Array<() => void> = [];
  private readonly reported = new Set<string>();
  private active: Track | null = null;
  private wanted: AudioLayer | null = null;
  private endedVersion: number | null = null;
  private disposed = false;
  private cancelFade: (() => void) | null = null;
  private clearing = false;
  private manualFade: ManualFade | null = null;
  private gain = 1;
  private volume = 1;

  constructor(
    parent: HTMLElement,
    private readonly options: AudioPlayerOptions,
  ) {
    this.tracks = Array.from({length: 2}, () => {
      const element = document.createElement('audio');
      element.muted = options.muted ?? true;
      element.preload = 'auto';
      element.hidden = true;
      parent.append(element);
      return {
        element,
        layer: null,
        ready: false,
        attempted: false,
        generation: 0,
      };
    });
    for (const track of this.tracks) {
      this.listen(track, 'canplay', () => this.ready(track));
      this.listen(track, 'error', () => {
        if (track.layer !== null) {
          track.attempted = true;
          this.report(new Error(`Audio failed: ${track.layer.mediaId}`));
        }
      });
      this.listen(track, 'ended', () => {
        const playback = track.layer?.playback;
        if (
          track !== this.active ||
          playback === undefined ||
          playback.since === null ||
          playback.trackVersion !== this.wanted?.playback?.trackVersion ||
          this.endedVersion === playback.trackVersion
        ) {
          return;
        }
        this.endedVersion = playback.trackVersion;
        if (this.manualFade !== null) this.finishManualFade(this.manualFade);
        else this.options.onNext(playback.trackVersion);
      });
    }
  }

  show(state: LiveState): void {
    if (this.disposed) return;
    this.attempt(() => {
      const layer = state.layers.audio;
      this.wanted = layer;
      this.volume = (state.audioVolume ?? 100) / 100;
      if (this.followFade(layer)) return;
      const fallback = this.active;
      if (
        layer?.playback?.since === null &&
        fallback !== null &&
        fallback.layer?.playback?.trackVersion !== layer.playback.trackVersion
      ) {
        this.attempt(() => fallback.element.pause());
      }
      for (const track of this.tracks) {
        const volume = this.volume * this.gain;
        if (track.element.volume !== volume) track.element.volume = volume;
        if (
          track.layer !== null &&
          track !== this.active &&
          track.layer.playback?.trackVersion !== layer?.playback?.trackVersion
        ) {
          this.attempt(() => this.unload(track));
        }
      }
      if (layer?.playback === undefined) {
        if (this.active !== null && !this.clearing) this.clearAudio();
        return;
      }
      const playback = layer.playback;
      const existing = this.tracks.find(
        track => track.layer?.playback?.trackVersion === playback.trackVersion,
      );
      if (existing !== undefined) {
        const previous = existing.layer?.playback;
        existing.layer = layer;
        if (
          previous?.since !== playback.since ||
          previous.positionSeconds !== playback.positionSeconds
        ) {
          existing.generation += 1;
          existing.attempted = false;
          if (playback.since === null) existing.element.pause();
          this.synchronize(existing);
        }
        return;
      }
      const spare = this.tracks.find(track => track !== this.active);
      if (spare === undefined) return;
      this.unload(spare);
      spare.layer = layer;
      spare.element.src = mediaUrl(layer.mediaId);
      spare.element.load();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelFade?.();
    this.cancelFade = null;
    for (const release of this.releases) release();
    for (const track of this.tracks) {
      this.attempt(() => this.unload(track));
      track.element.remove();
    }
    this.reported.clear();
  }

  private clearAudio(): void {
    if (this.active === null) return;
    const startGain = this.gain;
    const finish = (): void => {
      this.clearing = false;
      this.cancelFade = null;
      this.gain = 1;
      this.stopTracks();
    };
    this.clearing = true;
    try {
      this.cancelFade = fadeAudio({
        durationMs: AUDIO_CLEAR_FADE_MS,
        now: this.options.now,
        gain: fraction => this.setGain(startGain * fraction),
        end: finish,
        onError: error => this.report(error),
      });
    } catch (error) {
      this.report(error);
      finish();
    }
  }

  private followFade(layer: AudioLayer | null): boolean {
    const playback = layer?.playback;
    const manual = this.manualFade;
    if (
      manual !== null &&
      manual.trackVersion === playback?.trackVersion &&
      manual.since === playback.fadeOutSince
    ) {
      return manual.done;
    }
    if (playback !== undefined || !this.clearing) {
      this.cancelFade?.();
      this.cancelFade = null;
      if (this.clearing) this.stopTracks();
      this.clearing = false;
      this.manualFade = null;
      if (playback !== undefined) this.gain = 1;
    }
    if (playback?.fadeOutSince !== undefined) {
      return this.startManualFade(playback.trackVersion, playback.fadeOutSince)
        .done;
    }
    return false;
  }

  private startManualFade(trackVersion: number, since: number): ManualFade {
    const manual: ManualFade = {trackVersion, since, done: false};
    this.manualFade = manual;
    try {
      const remaining = Math.max(
        0,
        AUDIO_MANUAL_FADE_MS - Math.max(0, this.options.now() - since),
      );
      if (remaining === 0) {
        this.finishManualFade(manual);
        return manual;
      }
      const startGain = remaining / AUDIO_MANUAL_FADE_MS;
      this.setGain(startGain);
      this.cancelFade = fadeAudio({
        durationMs: remaining,
        now: this.options.now,
        gain: fraction => this.setGain(startGain * fraction),
        end: () => this.finishManualFade(manual),
        onError: error => this.report(error),
      });
    } catch (error) {
      this.report(error);
      this.finishManualFade(manual);
    }
    return manual;
  }

  private finishManualFade(manual: ManualFade): void {
    if (this.manualFade !== manual || manual.done) return;
    manual.done = true;
    this.cancelFade?.();
    this.cancelFade = null;
    this.attempt(() => this.setGain(0));
    this.stopTracks();
    this.options.onFadeEnd(manual.trackVersion, manual.since);
  }

  private setGain(gain: number): void {
    this.gain = gain;
    const volume = this.volume * gain;
    for (const track of this.tracks) {
      if (track.element.volume !== volume) track.element.volume = volume;
    }
  }

  private stopTracks(): void {
    this.active = null;
    for (const track of this.tracks) {
      if (track.layer !== null) this.attempt(() => this.unload(track));
    }
  }

  private listen(track: Track, event: string, run: () => void): void {
    const listener = (): void => {
      if (!this.disposed) this.attempt(run);
    };
    track.element.addEventListener(event, listener);
    this.releases.push(() =>
      track.element.removeEventListener(event, listener),
    );
  }

  private ready(track: Track): void {
    track.ready = true;
    this.synchronize(track);
  }

  private synchronize(track: Track): void {
    const playback = track.layer?.playback;
    if (
      playback === undefined ||
      !track.ready ||
      track.attempted ||
      playback.trackVersion !== this.wanted?.playback?.trackVersion
    ) {
      return;
    }
    track.attempted = true;
    const generation = track.generation;
    const commit = (): void => {
      if (
        this.disposed ||
        track.generation !== generation ||
        this.wanted?.playback?.trackVersion !== playback.trackVersion
      ) {
        return;
      }
      const previous = this.active;
      this.active = track;
      if (previous !== null && previous !== track) {
        this.attempt(() => this.unload(previous));
      }
    };
    this.seek(track);
    if (playback.since === null) {
      track.element.pause();
      commit();
      return;
    }
    track.element.play().then(
      () => this.attempt(commit),
      (error: unknown) => {
        if (!this.disposed && track.generation === generation) {
          this.report(error);
        }
      },
    );
  }

  private seek(track: Track): void {
    const playback = track.layer?.playback;
    if (playback === undefined) return;
    const position = audioPositionSeconds(playback, this.options.now());
    const duration = track.element.duration;
    track.element.currentTime = Number.isFinite(duration)
      ? Math.min(position, duration)
      : position;
  }

  private unload(track: Track): void {
    track.layer = null;
    track.generation += 1;
    track.ready = false;
    track.attempted = false;
    try {
      track.element.pause();
    } finally {
      track.element.removeAttribute('src');
      track.element.load();
    }
  }

  private attempt(run: () => void): void {
    try {
      run();
    } catch (error) {
      this.report(error);
    }
  }

  private report(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    if (
      this.reported.has(message) ||
      this.reported.size >= MAX_REPORTED_AUDIO_ERRORS
    ) {
      return;
    }
    this.reported.add(message);
    this.options.onError('could not play audio', error);
  }
}
