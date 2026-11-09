import type {LlpApi} from '@contracts/ipc/api';
import type {LiveState, MediaLayer} from '@core/live/state';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {BackgroundLayerView} from '../rendering/backgroundLayer';
import {fadeAudio} from '../rendering/audioFade';
import {themeMediaAudible, themeOverlayAudio} from '@core/themes/audio';
import type {MediaDocument} from '@core/schema/mediaEdit';

/** Plays background sound once, independently of the preloaded screen windows. */
export class BackgroundAudio {
  private readonly view: BackgroundLayerView;
  private overlay: BackgroundLayerView | null = null;
  private overlayStartedAt: number | null = null;
  private readonly createOverlay: () => BackgroundLayerView;
  private state: LiveState | null = null;
  private disposed = false;
  private pictures = new Set<string>();
  private mediaRevision = -1;
  private mediaReady = false;
  private readonly stopMedia: () => void;
  private sinkId = '';
  private previous: MediaLayer | null = null;
  private fade: {since: number; durationMs: number; cancel: () => void} | null =
    null;

  private readonly report: (message: string, error: unknown) => void;
  private readonly now: () => number;

  constructor({
    root,
    api,
    muted,
    report,
    now,
  }: {
    root: HTMLElement;
    api: LlpApi;
    muted: boolean;
    report: (message: string, error: unknown) => void;
    now: () => number;
  }) {
    this.report = report;
    this.now = now;
    this.view = new BackgroundLayerView(root, {
      mediaUrl,
      muted,
      onError: report,
    });
    this.createOverlay = () => {
      const overlay = new BackgroundLayerView(root, {
        mediaUrl,
        muted,
        onError: report,
      });
      overlay.setSink(this.sinkId);
      return overlay;
    };
    this.stopMedia = api.media.subscribe(document =>
      this.acceptMedia(document),
    );
    api.media.get().then(
      document => this.acceptMedia(document),
      (error: unknown) => {
        if (!this.disposed) {
          report('could not read background audio media', error);
          /** Keep playback available; later metadata pushes restore filtering. */
          this.mediaReady = true;
          this.draw();
        }
      },
    );
  }

  /** Plays the video sound to a device; an empty id is the Windows default. */
  setSink(sinkId: string): void {
    this.sinkId = sinkId;
    this.view.setSink(sinkId);
    this.overlay?.setSink(sinkId);
  }

  show(state: LiveState): void {
    if (state.themeOutput === undefined) return;
    this.state = state;
    this.draw();
  }

  dispose(): void {
    this.disposed = true;
    this.stopMedia();
    this.pictures.clear();
    this.fade?.cancel();
    this.view.dispose();
    this.overlay?.dispose();
  }

  private acceptMedia(document: MediaDocument): void {
    if (this.disposed || document.revision <= this.mediaRevision) return;
    this.mediaRevision = document.revision;
    this.mediaReady = true;
    this.pictures = new Set(
      document.value.items
        .filter(item => item.kind === 'image')
        .map(item => item.id),
    );
    this.draw();
  }

  private sound(media: MediaLayer | null): MediaLayer | null {
    return media !== null && this.pictures.has(media.mediaId) ? null : media;
  }

  private draw(): void {
    if (this.disposed || this.state === null || !this.mediaReady) return;
    try {
      const state = this.state;
      const overlay = this.sound(themeOverlayAudio(state));
      if (overlay !== null) this.overlay ??= this.createOverlay();
      if (
        overlay !== null &&
        this.overlayStartedAt !== null &&
        this.overlayStartedAt !== overlay.startedAt
      ) {
        this.overlay?.show(null, false);
      }
      this.overlayStartedAt = overlay?.startedAt ?? null;
      this.overlay?.show(overlay, false);
      const audible = themeMediaAudible(state);
      const media = state.layers.media;
      if (!audible) {
        this.stopFade();
        this.previous = null;
        this.view.show(null, false);
        return;
      }
      if (media !== null) {
        /** The picture held its position, so sound must seek on restore. */
        if (this.fade !== null) {
          this.view.show(null, false);
        }
        this.stopFade();
        this.previous =
          media.properties?.audio === true ? this.sound(media) : null;
        this.view.show(this.previous, false);
        return;
      }
      const effect = state.clearEffects?.find(
        item => item.target.kind === 'layer' && item.target.layer === 'media',
      );
      if (effect === undefined || this.previous === null) {
        this.stopFade();
        this.view.show(null, false);
        return;
      }
      if (
        this.fade?.since === effect.since &&
        this.fade.durationMs === effect.durationMs
      ) {
        return;
      }
      this.stopFade();
      const remaining = Math.max(
        0,
        effect.since + effect.durationMs - this.now(),
      );
      if (remaining === 0) {
        this.previous = null;
        this.view.show(null, false);
        return;
      }
      const startGain = Math.min(1, remaining / effect.durationMs);
      this.view.setAudioGain(startGain);
      const cancel = fadeAudio({
        durationMs: remaining,
        now: this.now,
        gain: fraction => this.view.setAudioGain(startGain * fraction),
        end: () => {
          this.fade = null;
          this.previous = null;
          try {
            this.view.show(null, false);
          } finally {
            this.view.setAudioGain(1);
          }
        },
        onError: error => this.report('could not fade background audio', error),
      });
      this.fade = {since: effect.since, durationMs: effect.durationMs, cancel};
    } catch (error) {
      this.report('could not update background audio', error);
    }
  }

  private stopFade(): void {
    if (this.fade === null) return;
    this.fade.cancel();
    this.fade = null;
    this.view.setAudioGain(1);
  }
}
