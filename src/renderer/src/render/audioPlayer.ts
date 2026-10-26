import type {AudioLayer, LiveState} from '@shared/live';
import {mediaUrl} from '@shared/media';
import {audioPositionSeconds} from '@shared/schema/audioState';

interface AudioPlayerOptions {
  readonly now: () => number;
  readonly onNext: (trackVersion: number) => void;
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
        this.options.onNext(playback.trackVersion);
      });
    }
  }

  show(state: LiveState): void {
    if (this.disposed) return;
    this.attempt(() => {
      const layer = state.layers.audio;
      this.wanted = layer;
      const fallback = this.active;
      if (
        layer?.playback?.since === null &&
        fallback !== null &&
        fallback.layer?.playback?.trackVersion !== layer.playback.trackVersion
      ) {
        this.attempt(() => fallback.element.pause());
      }
      for (const track of this.tracks) {
        const volume = (state.audioVolume ?? 100) / 100;
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
        this.active = null;
        for (const track of this.tracks) {
          if (track.layer !== null) this.attempt(() => this.unload(track));
        }
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
    for (const release of this.releases) release();
    for (const track of this.tracks) {
      this.attempt(() => this.unload(track));
      track.element.remove();
    }
    this.reported.clear();
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
