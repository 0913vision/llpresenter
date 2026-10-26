import type {AudioLayer, LiveState} from '@shared/live';
import {mediaUrl} from '@shared/media';
import {audioPositionSeconds} from '@shared/schema/audioState';

interface AudioPlayerOptions {
  readonly now: () => number;
  readonly onNext: () => void;
  readonly onError: (message: string, error: unknown) => void;
  readonly muted?: boolean;
}

interface Track {
  readonly element: HTMLAudioElement;
  layer: AudioLayer | null;
  starting: boolean;
}

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
      return {element, layer: null, starting: false};
    });
    for (const track of this.tracks) {
      this.listen(track, 'canplay', () => this.ready(track));
      this.listen(track, 'error', () => {
        if (track.layer !== null)
          this.report(new Error(`Audio failed: ${track.layer.mediaId}`));
      });
      this.listen(track, 'ended', () => {
        const playback = track.layer?.playback;
        if (
          track !== this.active ||
          playback?.since === null ||
          playback === undefined ||
          playback.trackVersion !== this.wanted?.playback?.trackVersion ||
          this.endedVersion === playback.trackVersion
        )
          return;
        this.endedVersion = playback.trackVersion;
        this.options.onNext();
      });
    }
  }

  show(state: LiveState): void {
    if (this.disposed) return;
    this.attempt(() => {
      const layer = state.layers.audio;
      this.wanted = layer;
      for (const track of this.tracks)
        track.element.volume = (state.audioVolume ?? 100) / 100;
      if (layer?.playback === undefined) {
        for (const track of this.tracks) this.unload(track);
        this.active = null;
        return;
      }
      const playing = this.active;
      if (
        playing?.layer?.playback?.trackVersion === layer.playback.trackVersion
      ) {
        const previous = playing.layer?.playback;
        playing.layer = layer;
        if (
          previous?.since !== layer.playback.since ||
          previous.positionSeconds !== layer.playback.positionSeconds
        ) {
          this.transport(playing);
        }
        return;
      }
      const spare = this.tracks.find(track => track !== playing);
      if (spare === undefined) return;
      if (spare.layer?.playback?.trackVersion === layer.playback.trackVersion) {
        spare.layer = layer;
        return;
      }
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
    const layer = track.layer;
    if (
      track === this.active ||
      layer?.playback === undefined ||
      track.starting ||
      layer.playback.trackVersion !== this.wanted?.playback?.trackVersion
    )
      return;
    track.starting = true;
    const commit = (): void => {
      if (
        this.disposed ||
        track.layer?.playback?.trackVersion !== layer.playback?.trackVersion ||
        this.wanted?.playback?.trackVersion !== layer.playback?.trackVersion
      )
        return;
      const previous = this.active;
      this.active = track;
      if (previous !== null && previous !== track)
        this.attempt(() => this.unload(previous));
    };
    this.seek(track);
    if (layer.playback.since === null) {
      commit();
      return;
    }
    track.element.play().then(
      () => this.attempt(commit),
      error => this.report(error),
    );
  }

  private transport(track: Track): void {
    this.seek(track);
    if (track.layer?.playback?.since === null) track.element.pause();
    else void track.element.play().catch(error => this.report(error));
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
    track.starting = false;
    track.element.pause();
    track.element.removeAttribute('src');
    track.element.load();
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
    if (this.disposed || this.reported.has(message) || this.reported.size >= 32)
      return;
    this.reported.add(message);
    this.options.onError('could not play audio', error);
  }
}
