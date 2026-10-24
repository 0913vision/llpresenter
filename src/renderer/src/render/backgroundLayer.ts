import type {MediaLayer} from '@shared/live';
import {classes} from './classes';

/** The dissolve between backgrounds (docs/spec/03-output.md, version 1 default). */
export const BACKGROUND_DISSOLVE_MS = 500;

export interface BackgroundLayerOptions {
  /** The URL that plays a library media file. */
  readonly mediaUrl: (mediaId: string) => string;
  readonly onError: (message: string, error: unknown) => void;
}

type VideoIndex = 0 | 1;

interface Handover {
  readonly to: VideoIndex;
  readonly dissolve: boolean;
}

const FRONT_LAYER = '1';
const BACK_LAYER = '0';

function otherOf(index: VideoIndex): VideoIndex {
  return index === 0 ? 1 : 0;
}

function createVideo(): HTMLVideoElement {
  const video = document.createElement('video');
  video.className = classes.video;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.disablePictureInPicture = true;
  return video;
}

function hide(video: HTMLVideoElement): void {
  video.classList.remove(classes.shown, classes.dissolving);
  video.style.zIndex = BACK_LAYER;
}

function unload(video: HTMLVideoElement): void {
  // NOTE(0913vision): Removing the source and loading again gives the
  // decoder memory back (docs/TECH.md, memory).
  video.pause();
  video.removeAttribute('src');
  video.load();
}

/**
 * The background media layer. It keeps two video elements for its whole
 * life: the one on screen and a spare. A looping background hands over to the
 * spare, loaded at the start, the moment the front one ends, so the loop has
 * no gap. A new background starts on the spare and dissolves in over the old
 * one, which then becomes the spare for the new background.
 */
export class BackgroundLayerView {
  private readonly element = document.createElement('div');
  private readonly videos: readonly [HTMLVideoElement, HTMLVideoElement];
  private readonly stopListening: () => void;
  private front: VideoIndex = 0;
  private current: MediaLayer | null = null;
  private handover: Handover | null = null;
  private spareTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    parent: HTMLElement,
    private readonly options: BackgroundLayerOptions,
  ) {
    this.element.className = classes.layer;
    this.element.style.setProperty(
      '--background-dissolve',
      `${BACKGROUND_DISSOLVE_MS}ms`,
    );
    this.videos = [createVideo(), createVideo()];
    this.element.append(...this.videos);
    this.stopListening = this.listen();
    parent.append(this.element);
  }

  /**
   * Starts the background, or clears the layer at once for null. The same
   * media again keeps playing without a restart (docs/spec/03-output.md).
   */
  show(media: MediaLayer | null): void {
    const unchanged = media?.mediaId === this.current?.mediaId;
    this.current = media;
    if (unchanged) return;
    this.cancelSpare();
    if (media === null) this.clearAtOnce();
    else this.start(media);
  }

  dispose(): void {
    this.cancelSpare();
    this.stopListening();
    for (const video of this.videos) unload(video);
    this.element.remove();
  }

  private start(media: MediaLayer): void {
    const to = otherOf(this.front);
    const video = this.videos[to];
    video.src = this.options.mediaUrl(media.mediaId);
    this.handover = {to, dissolve: true};
    this.play(video);
  }

  private clearAtOnce(): void {
    this.handover = null;
    for (const video of this.videos) {
      hide(video);
      unload(video);
    }
  }

  private listen(): () => void {
    const removers = this.videos.flatMap((video, index) => {
      const at: VideoIndex = index === 0 ? 0 : 1;
      const onPlaying = (): void => this.handlePlaying(at);
      const onEnded = (): void => this.handleEnded(at);
      const onError = (): void => this.handleError(video);
      video.addEventListener('playing', onPlaying);
      video.addEventListener('ended', onEnded);
      video.addEventListener('error', onError);
      return [
        () => video.removeEventListener('playing', onPlaying),
        () => video.removeEventListener('ended', onEnded),
        () => video.removeEventListener('error', onError),
      ];
    });
    return () => {
      for (const remove of removers) remove();
    };
  }

  private handlePlaying(index: VideoIndex): void {
    if (this.handover?.to !== index) return;
    const {dissolve} = this.handover;
    this.handover = null;
    const previous = this.videos[this.front];
    const next = this.videos[index];
    next.style.zIndex = FRONT_LAYER;
    previous.style.zIndex = BACK_LAYER;
    next.classList.toggle(classes.dissolving, dissolve);
    next.classList.add(classes.shown);
    this.front = index;
    if (dissolve) {
      this.spareTimer = setTimeout(
        () => this.prepareSpare(),
        BACKGROUND_DISSOLVE_MS,
      );
    } else {
      hide(previous);
      previous.pause();
      previous.currentTime = 0;
    }
  }

  private handleEnded(index: VideoIndex): void {
    if (index !== this.front || this.current?.loop !== true) return;
    const spareIndex = otherOf(index);
    const spare = this.videos[spareIndex];
    if (spare.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.restart(this.videos[index]);
      return;
    }
    this.handover = {to: spareIndex, dissolve: false};
    this.play(spare);
  }

  private handleError(video: HTMLVideoElement): void {
    if (this.handover !== null && this.videos[this.handover.to] === video) {
      this.handover = null;
    }
    this.options.onError('could not play a background video', {
      src: video.getAttribute('src'),
      code: video.error?.code ?? null,
      message: video.error?.message ?? null,
    });
  }

  private prepareSpare(): void {
    this.spareTimer = null;
    const spare = this.videos[otherOf(this.front)];
    hide(spare);
    if (this.current === null) {
      unload(spare);
      return;
    }
    spare.pause();
    spare.src = this.options.mediaUrl(this.current.mediaId);
  }

  private restart(video: HTMLVideoElement): void {
    video.currentTime = 0;
    this.play(video);
  }

  private play(video: HTMLVideoElement): void {
    video.play().catch((error: unknown) => {
      this.options.onError('could not start a background video', error);
    });
  }

  private cancelSpare(): void {
    if (this.spareTimer === null) return;
    clearTimeout(this.spareTimer);
    this.spareTimer = null;
  }
}
