import type {MediaLayer} from '@shared/live';
import {loadBackgroundImage} from './backgroundImage';
import {classes} from './classes';
import {OUTPUT_TRANSITIONS} from './transitions';

/** The dissolve between backgrounds (docs/spec/03-output.md, version 1 default). */
export const BACKGROUND_DISSOLVE_MS = OUTPUT_TRANSITIONS.backgroundMs;

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
const UNSUPPORTED_SOURCE = 4;
export const VIDEO_FRAME_DEADLINE_MS = 250;

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
  readonly contentChange: boolean;
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

function createImage(): HTMLImageElement {
  const image = document.createElement('img');
  image.className = classes.image;
  image.alt = '';
  return image;
}

function hide(element: HTMLElement): void {
  element.classList.remove(classes.shown, classes.dissolving);
  element.style.zIndex = BACK_LAYER;
}

function unload(video: HTMLVideoElement): void {
  // NOTE(0913vision): Removing the source and loading again gives the
  // decoder memory back (docs/TECH.md, memory).
  video.pause();
  video.removeAttribute('src');
  video.load();
}

/**
 * Keeps two reusable videos and two images. A looping video hands over to
 * the spare, loaded at the start, when the front ends. A new background
 * starts on the spare and dissolves over the old one.
 */
export class BackgroundLayerView {
  private readonly element = document.createElement('div');
  private readonly videos: readonly [HTMLVideoElement, HTMLVideoElement];
  private readonly images: readonly [HTMLImageElement, HTMLImageElement];
  private readonly stopImages: [(() => void) | null, (() => void) | null] = [
    null,
    null,
  ];
  private readonly holding: [string | null, string | null] = [null, null];
  private readonly stopListening: () => void;
  private front: VideoIndex = 0;
  private current: MediaLayer | null = null;
  private handover: Handover | null = null;
  private spareTimer: ReturnType<typeof setTimeout> | null = null;
  private stopWaitingToSeek: (() => void) | null = null;
  private transitions = true;
  private failed = false;
  private held = false;
  private readonly decoded: [boolean, boolean] = [false, false];
  private readonly videoFrames: [number | null, number | null] = [null, null];
  private readonly frameDeadlines: [
    ReturnType<typeof setTimeout> | null,
    ReturnType<typeof setTimeout> | null,
  ] = [null, null];

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
    this.images = [createImage(), createImage()];
    this.element.append(...this.videos, ...this.images);
    this.stopListening = this.listen();
    parent.append(this.element);
  }

  /**
   * Starts the background, or clears the layer at once for null. The same
   * media again keeps playing without a restart (docs/spec/03-output.md).
   */
  show(media: MediaLayer | null, transitions = true): void {
    if (this.held) {
      this.held = false;
      this.current = null;
      this.clearAtOnce();
    }
    this.transitions = transitions;
    if (this.handover?.contentChange === true) {
      this.handover = {...this.handover, dissolve: transitions};
    }
    if (!transitions) {
      for (const element of [...this.videos, ...this.images]) {
        element.classList.remove(classes.dissolving);
      }
      if (this.handover !== null) {
        this.handover = {...this.handover, dissolve: false};
      }
    }
    const unchanged = media?.mediaId === this.current?.mediaId;
    this.current = media;
    if (unchanged) {
      this.loopNativelyInPreview();
      return;
    }
    this.failed = false;
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

  /** Freezes the cleared frame until its explicit fade finishes or is restored. */
  hold(): void {
    if (this.held) return;
    this.held = true;
    this.cancelSpare();
    this.cancelSeek();
    for (const video of this.videos) video.pause();
  }

  ready(): boolean {
    return (
      this.current === null ||
      this.failed ||
      (this.handover === null &&
        this.holdsCurrent(this.front) &&
        this.decoded[this.front])
    );
  }

  private start(media: MediaLayer): void {
    const to = otherOf(this.front);
    const video = this.videos[to];
    this.settleFront(to);
    this.load(to, media.mediaId);
    this.seekOnceLoaded(video, media);
    this.handover = {to, dissolve: this.transitions, contentChange: true};
    this.loopNativelyInPreview();
    this.play(video);
  }

  private settleFront(reused: VideoIndex): void {
    // NOTE(0913vision): A dissolve still running ends at once: the front picture
    // turns fully opaque before the reused one is hidden and reloaded, so no
    // black shows under the front and the next background fades in fresh.
    this.pictureAt(this.front).classList.remove(classes.dissolving);
    this.hideAt(reused);
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
    for (const index of VIDEO_INDEXES) this.hideAt(index);
    this.unloadAt(0);
    this.unloadAt(1);
  }

  private load(index: VideoIndex, mediaId: string): void {
    this.cancelFrame(index);
    this.clearImage(index);
    this.videos[index].src = this.options.mediaUrl(mediaId);
    this.holding[index] = mediaId;
  }

  private unloadAt(index: VideoIndex): void {
    this.cancelFrame(index);
    this.clearImage(index);
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
      const onPlaying = (): void => {
        if (this.held) {
          video.pause();
          return;
        }
        if (this.isImage(at)) return;
        this.handlePlaying(at);
        if (!this.holdsCurrent(at)) return;
        if (typeof video.requestVideoFrameCallback === 'function') {
          this.cancelFrame(at);
          const source = this.holding[at];
          this.videoFrames[at] = video.requestVideoFrameCallback(() => {
            this.videoFrames[at] = null;
            if (this.holding[at] === source && this.holdsCurrent(at)) {
              this.clearFrameDeadline(at);
              this.decoded[at] = true;
            }
          });
          this.frameDeadlines[at] = setTimeout(() => {
            this.frameDeadlines[at] = null;
            if (this.holding[at] !== source || !this.holdsCurrent(at)) return;
            if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
            this.cancelFrame(at);
            this.decoded[at] = true;
          }, VIDEO_FRAME_DEADLINE_MS);
        } else this.decoded[at] = true;
      };
      const onEnded = (): void => this.handleEnded(at);
      const onError = (): void => this.handleError(at);
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
    if (this.held) return;
    if (this.handover?.to !== index) return;
    const {dissolve} = this.handover;
    this.handover = null;
    const previous = this.pictureAt(this.front);
    const next = this.pictureAt(index);
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
      this.videos[otherOf(index)].pause();
      this.videos[otherOf(index)].currentTime = 0;
      if (!this.holdsCurrent(otherOf(index))) this.prepareSpare();
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
        !this.isImage(index) &&
        index === showing &&
        this.holdsCurrent(index) &&
        this.current?.loop === true;
    }
  }

  private handleEnded(index: VideoIndex): void {
    if (this.held) return;
    if (this.isPreview() || this.isImage(index)) return;
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
    this.handover = {to: spareIndex, dissolve: false, contentChange: false};
    this.play(spare);
  }

  private handleError(index: VideoIndex): void {
    if (this.isImage(index)) return;
    const video = this.videos[index];
    if (video.error?.code === UNSUPPORTED_SOURCE && this.tryImage(index)) {
      return;
    }
    const detail = {
      src: video.getAttribute('src'),
      code: video.error?.code ?? null,
      message: video.error?.message ?? null,
    };
    this.fail(index);
    this.options.onError('could not play a background video', detail);
  }

  private prepareSpare(): void {
    this.spareTimer = null;
    const spareIndex = otherOf(this.front);
    this.hideAt(spareIndex);
    if (this.current === null || this.isPreview() || this.isImage(this.front)) {
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
    const src = video.getAttribute('src');
    video.play().catch((error: unknown) => {
      if (video.getAttribute('src') !== src) return;
      // NOTE(0913vision): A play() that our own pause or source change
      // interrupts rejects with AbortError. That is expected, not a fault.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      const index: VideoIndex = video === this.videos[0] ? 0 : 1;
      if (
        error instanceof DOMException &&
        error.name === 'NotSupportedError' &&
        this.tryImage(index)
      ) {
        return;
      }
      this.options.onError('could not start a background video', error);
      this.fail(index);
    });
  }

  private isImage(index: VideoIndex): boolean {
    return this.images[index].hasAttribute('src');
  }

  private pictureAt(index: VideoIndex): HTMLElement {
    return this.isImage(index) ? this.images[index] : this.videos[index];
  }

  private hideAt(index: VideoIndex): void {
    hide(this.videos[index]);
    hide(this.images[index]);
  }

  private clearImage(index: VideoIndex): void {
    this.stopImages[index]?.();
    this.stopImages[index] = null;
  }

  private tryImage(index: VideoIndex): boolean {
    if (this.handover?.to !== index || !this.holdsCurrent(index)) return false;
    if (this.isImage(index)) return true;
    const src = this.videos[index].getAttribute('src');
    if (src === null) return false;
    this.cancelFrame(index);
    this.cancelSeek();
    unload(this.videos[index]);
    this.stopImages[index] = loadBackgroundImage(this.images[index], {
      src,
      onReady: () => {
        this.decoded[index] = true;
        this.handlePlaying(index);
      },
      onError: () => {
        this.fail(index);
        this.options.onError('could not load a background media file', {src});
      },
    });
    this.loopNativelyInPreview();
    return true;
  }

  private fail(index: VideoIndex): void {
    if (!this.holdsCurrent(index)) return;
    if (this.handover?.to !== index && this.front !== index) return;
    this.failed = true;
    this.handover = null;
    this.cancelSpare();
    this.cancelSeek();
    if (index === this.front && this.decoded[index]) {
      this.videos[index].pause();
      return;
    }
    this.hideAt(index);
    this.unloadAt(index);
    if (index !== this.front && !this.decoded[this.front]) {
      this.hideAt(this.front);
      this.unloadAt(this.front);
    }
  }

  private cancelSpare(): void {
    if (this.spareTimer === null) return;
    clearTimeout(this.spareTimer);
    this.spareTimer = null;
  }

  private cancelFrame(index: VideoIndex): void {
    this.clearFrameDeadline(index);
    const frame = this.videoFrames[index];
    if (frame !== null) this.videos[index].cancelVideoFrameCallback(frame);
    this.videoFrames[index] = null;
    this.decoded[index] = false;
  }

  private clearFrameDeadline(index: VideoIndex): void {
    const timer = this.frameDeadlines[index];
    if (timer !== null) clearTimeout(timer);
    this.frameDeadlines[index] = null;
  }
}
