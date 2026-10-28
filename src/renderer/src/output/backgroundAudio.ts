import type {LlpApi} from '@shared/ipc';
import type {LiveState, MediaLayer} from '@shared/live';
import type {LooksFile} from '@shared/schema/looks';
import type {Screen} from '@shared/schema/screens';
import {mediaUrl} from '@shared/media';
import {BackgroundLayerView} from '../render/backgroundLayer';
import {fadeAudio} from '../render/audioFade';
import {resolveScreenLook, showsLayer} from '../render/screenLook';
import {followSettingsDocument} from '../render/settingsFeed';

/** Plays background sound once, independently of the preloaded screen windows. */
export class BackgroundAudio {
  private readonly view: BackgroundLayerView;
  private readonly stops: ReadonlyArray<() => void>;
  private screens: readonly Screen[] | null = null;
  private looks: LooksFile | null = null;
  private state: LiveState | null = null;
  private disposed = false;
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
    this.stops = [
      followSettingsDocument({
        settings: api.settings,
        name: 'screens',
        select: document =>
          document.name === 'screens' ? document.value.screens : undefined,
        receive: screens => {
          this.screens = screens;
          this.draw();
        },
        onError: error =>
          report('could not read screens for background audio', error),
      }),
      followSettingsDocument({
        settings: api.settings,
        name: 'looks',
        select: document =>
          document.name === 'looks' ? document.value : undefined,
        receive: looks => {
          this.looks = looks;
          this.draw();
        },
        onError: error =>
          report('could not read Looks for background audio', error),
      }),
    ];
  }

  show(state: LiveState): void {
    this.state = state;
    this.draw();
  }

  dispose(): void {
    this.disposed = true;
    this.fade?.cancel();
    for (const stop of this.stops) stop();
    this.view.dispose();
  }

  private draw(): void {
    if (this.disposed || this.state === null) return;
    try {
      const state = this.state;
      const audible =
        this.looks !== null &&
        this.screens?.some(
          screen =>
            state.outputs[screen.id] === true &&
            showsLayer(
              resolveScreenLook(this.looks, state.lookId, screen).appearance,
              'media',
            ),
        ) === true;
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
        this.previous = media.properties?.audio === true ? media : null;
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
