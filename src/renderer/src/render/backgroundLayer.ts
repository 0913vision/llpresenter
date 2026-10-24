import type {MediaLayer} from '@shared/live';
import {classes} from './classes';

/** The dissolve between backgrounds (docs/spec/03-output.md, version 1 default). */
export const BACKGROUND_DISSOLVE_MS = 500;

/**
 * Where a renderer draws: an output window, or a small preview in the control
 * window. A preview keeps one video playing per background, to spare
 * decoders over long runs.
 */
export type RenderMode = 'output' | 'preview';

export interface BackgroundLayerOptions {
  /** The URL that plays a library media file. */
  readonly mediaUrl: (mediaId: string) => string;
  readonly onError: (message: string, error: unknown) => void;
  /** `output` when absent. */
  readonly mode?: RenderMode;
}

/** A background less than this far along starts from the beginning instead of seeking. */
export const MIN_SEEK_SECONDS = 0.5;

const MS_PER_SECOND = 1000;

/**
 * Where a background should be now: the time since it started, wrapped for a
 * loop and held at the end otherwise, so a window that loads late (a relaunch,
 * a screen turned on later) shows the same picture as the others
 * (docs/spec/03-output.md, playback).
 *
 * @returns The position in seconds, or 0 to start from the beginning.
 */
export function startOffsetSeconds(
  media: MediaLayer,
  duration: number,
  now: number,
): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const elapsed = Math.max(0, (now - media.startedAt) / MS_PER_SECOND);
  const offset = media.loop ? elapsed % duration : Math.min(elapsed, duration);
  return offset < MIN_SEEK_SECONDS ? 0 : offset;
}

type VideoIndex = 0 | 1;

const VIDEO_INDEXES: readonly VideoIndex[] = [0, 1];

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
  private readonly holding: [string | null, string | null] = [null, null];
  private readonly stopListening: () => void;
  private front: VideoIndex = 0;
  private current: MediaLayer | null = null;
  private handover: Handover | null = null;
  private spareTimer: ReturnType<typeof setTimeout> | null = null;
  private stopWaitingToSeek: (() => void) | null = null;

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
    if (unchanged) {
      this.loopNativelyInPreview();
      return;
    }
    this.cancelSpare();
    this.cancelSeek();
    if (media === null) this.clearAtOnce();
    else this.start(media);
  }

  dispose(): void {
    this.cancelSpare();
    this.cancelSeek();
    this.stopListening();
    this.unloadAt(0);
    this.unloadAt(1);
    this.element.remove();
  }

  private start(media: MediaLayer): void {
    const to = otherOf(this.front);
    const video = this.videos[to];
    this.settleFront(to);
    this.load(to, media.mediaId);
    this.seekOnceLoaded(video, media);
    this.handover = {to, dissolve: true};
    this.loopNativelyInPreview();
    this.play(video);
  }

  private settleFront(reused: VideoIndex): void {
    // NOTE(0913vision): A dissolve still running ends at once: the front video
    // turns fully opaque before the reused one is hidden and reloaded, so no
    // black shows under the front and the next background fades in fresh.
    this.videos[this.front].classList.remove(classes.dissolving);
    hide(this.videos[reused]);
  }

  private seekOnceLoaded(video: HTMLVideoElement, media: MediaLayer): void {
    const onMetadata = (): void => {
      this.cancelSeek();
      const offset = startOffsetSeconds(media, video.duration, Date.now());
      if (offset > 0) video.currentTime = offset;
    };
    video.addEventListener('loadedmetadata', onMetadata);
    this.stopWaitingToSeek = () => {
      video.removeEventListener('loadedmetadata', onMetadata);
    };
  }

  private cancelSeek(): void {
    this.stopWaitingToSeek?.();
    this.stopWaitingToSeek = null;
  }

  private clearAtOnce(): void {
    this.handover = null;
    for (const video of this.videos) hide(video);
    this.unloadAt(0);
    this.unloadAt(1);
  }

  private load(index: VideoIndex, mediaId: string): void {
    this.videos[index].src = this.options.mediaUrl(mediaId);
    this.holding[index] = mediaId;
  }

  private unloadAt(index: VideoIndex): void {
    unload(this.videos[index]);
    this.holding[index] = null;
  }

  private holdsCurrent(index: VideoIndex): boolean {
    return (
      this.current !== null && this.holding[index] === this.current.mediaId
    );
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

  private isPreview(): boolean {
    return this.options.mode === 'preview';
  }

  private loopNativelyInPreview(): void {
    // NOTE(0913vision): A preview loops on the one video that shows, or is
    // about to show, the current background. The loop point may hitch for a
    // frame, which is fine on a small preview and halves its decoders. The
    // outgoing video holds its last frame, as in an output window.
    const showing = this.handover?.to ?? this.front;
    for (const index of VIDEO_INDEXES) {
      this.videos[index].loop =
        this.isPreview() &&
        index === showing &&
        this.holdsCurrent(index) &&
        this.current?.loop === true;
    }
  }

  private handleEnded(index: VideoIndex): void {
    if (this.isPreview()) return;
    // NOTE(0913vision): An outgoing background that ends while the next one
    // starts holds its last frame; only the current background loops.
    if (index !== this.front || !this.holdsCurrent(index)) return;
    if (this.current?.loop !== true) return;
    const spareIndex = otherOf(index);
    const spare = this.videos[spareIndex];
    const spareReady =
      this.holdsCurrent(spareIndex) &&
      spare.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    if (!spareReady) {
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
    const spareIndex = otherOf(this.front);
    hide(this.videos[spareIndex]);
    if (this.current === null || this.isPreview()) {
      this.unloadAt(spareIndex);
      return;
    }
    this.videos[spareIndex].pause();
    this.load(spareIndex, this.current.mediaId);
  }

  private restart(video: HTMLVideoElement): void {
    video.currentTime = 0;
    this.play(video);
  }

  private play(video: HTMLVideoElement): void {
    video.play().catch((error: unknown) => {
      // NOTE(0913vision): A play() that our own pause or source change
      // interrupts rejects with AbortError. That is expected, not a fault.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.options.onError('could not start a background video', error);
    });
  }

  private cancelSpare(): void {
    if (this.spareTimer === null) return;
    clearTimeout(this.spareTimer);
    this.spareTimer = null;
  }
}
