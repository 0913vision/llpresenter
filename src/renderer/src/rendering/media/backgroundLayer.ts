import type {MediaLayer} from '@core/schema/live/live';
import {StillBackgroundLayerView} from './stillBackgroundLayer';
import {PlaybackBackgroundLayerView} from './playbackBackgroundLayer';
import type {PreviewMediaSource} from './previewMedia';
import type {RenderMode} from '../layer';

/**
 * Where a renderer draws: an output window, or a small preview in the control
 * window. A preview draws cached thumbnails without creating video elements.
 */

export interface BackgroundLayerOptions {
  /** The original library URL, also used for image elements in previews. */
  readonly mediaUrl: (mediaId: string) => string;
  readonly previewMedia?: PreviewMediaSource | undefined;
  readonly onError: (message: string, error: unknown) => void;
  /** `output` when absent. */
  readonly mode?: RenderMode;
  readonly muted?: boolean;
}

/** Selects still-only control previews or the real output's retained players. */
export class BackgroundLayerView {
  private readonly view: PlaybackBackgroundLayerView | StillBackgroundLayerView;

  constructor(parent: HTMLElement, options: BackgroundLayerOptions) {
    this.view =
      options.mode === 'preview'
        ? new StillBackgroundLayerView(parent, options)
        : new PlaybackBackgroundLayerView(parent, options);
  }

  setSink(sinkId: string): void {
    if (this.view instanceof PlaybackBackgroundLayerView) {
      this.view.setSink(sinkId);
    }
  }

  setOnError(onError: BackgroundLayerOptions['onError']): void {
    this.view.setOnError(onError);
  }

  show(media: MediaLayer | null, standby = false): void {
    if (this.view instanceof PlaybackBackgroundLayerView) {
      this.view.show(media, standby);
    } else this.view.show(media);
  }

  remaining(): number | undefined {
    return this.view.remaining();
  }

  setAudioGain(gain: number): void {
    if (this.view instanceof PlaybackBackgroundLayerView) {
      this.view.setAudioGain(gain);
    }
  }

  hold(): void {
    if (this.view instanceof PlaybackBackgroundLayerView) this.view.hold();
  }

  ready(): boolean {
    return this.view.ready();
  }

  moveTo(parent: HTMLElement): boolean {
    return this.view instanceof PlaybackBackgroundLayerView
      ? this.view.moveTo(parent)
      : this.view.moveTo();
  }

  dispose(): void {
    this.view.dispose();
  }
}
