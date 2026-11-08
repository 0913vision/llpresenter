import type {MediaLayer} from '@core/live/state';
import type {OutputMediaProperties} from '@core/schema/outputMedia';
import {loadBackgroundImage} from './backgroundImage';
import {classes} from './classes';
import {applySink} from './audioSink';
import {OUTPUT_TRANSITIONS} from './transitions';
import {backgroundElapsedSeconds} from '@core/media/backgroundPosition';
import {mediaObjectFit} from '@core/media/objectFit';
import {StillBackgroundLayerView} from './stillBackgroundLayer';
import type {PreviewMediaSource} from './previewMedia';

/** The dissolve between backgrounds (docs/spec/03-output.md, version 1 default). */
export const BACKGROUND_DISSOLVE_MS = OUTPUT_TRANSITIONS.backgroundMs;

/**
 * Where a renderer draws: an output window, or a small preview in the control
 * window. A preview draws cached thumbnails without creating video elements.
 */
export type RenderMode = 'output' | 'preview';

export interface BackgroundLayerOptions {
  /** The original library URL, also used for image elements in previews. */
  readonly mediaUrl: (mediaId: string) => string;
  readonly previewMedia?: PreviewMediaSource | undefined;
  readonly onError: (message: string, error: unknown) => void;
  /** `output` when absent. */
  readonly mode?: RenderMode;
  readonly muted?: boolean;
}

/** A background less than this far along starts from the beginning instead of seeking. */
export const MIN_SEEK_SECONDS = 0.5;

const UNSUPPORTED_SOURCE = 4;
export const VIDEO_FRAME_DEADLINE_MS = 250;

/** How long a new background plays before the spare video for its loop loads. */
export const SPARE_DELAY_MS = 1500;

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
  const offset = playbackOffsetSeconds(media, duration, now);
  return offset < MIN_SEEK_SECONDS ? 0 : offset;
}

function playbackOffsetSeconds(
  media: MediaLayer,
  duration: number,
  now: number,
): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const elapsed = backgroundElapsedSeconds(media, now);
  return media.loop ? elapsed % duration : Math.min(elapsed, duration);
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
class PlaybackBackgroundLayerView {
  private readonly options: Omit<BackgroundLayerOptions, 'onError'>;
  private onError: BackgroundLayerOptions['onError'];
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
  private standby = false;
  private audioGain = 1;
  private sinkId = '';
  private dissolveMs: number = BACKGROUND_DISSOLVE_MS;
  private readonly decoded: [boolean, boolean] = [false, false];
  private readonly videoFrames: [number | null, number | null] = [null, null];
  private readonly frameDeadlines: [
    ReturnType<typeof setTimeout> | null,
    ReturnType<typeof setTimeout> | null,
  ] = [null, null];

  constructor(parent: HTMLElement, options: BackgroundLayerOptions) {
    const {onError, ...playback} = options;
    this.options = playback;
    this.onError = onError;
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
  /**
   * Plays the sound of both videos to a device (an empty id is the Windows
   * default); a video that starts later keeps the device.
   */
  setSink(sinkId: string): void {
    this.sinkId = sinkId;
    for (const video of this.videos) {
      applySink(video, sinkId, this.onError);
    }
  }

  /** Rebinds reports when a retained player changes its owning theme element. */
  setOnError(onError: BackgroundLayerOptions['onError']): void {
    this.onError = onError;
  }

  /**
   * Sets how long the next background takes to dissolve in; 0 is a cut. A
   * dissolve that is running keeps the time it started with.
   */
  setDissolveMs(ms: number): void {
    this.dissolveMs = ms;
  }

  show(media: MediaLayer | null, transitions = true, standby = false): void {
    const resumed = this.standby && !standby;
    const suspended = !this.standby && standby;
    this.standby = standby;
    if (this.held) {
      this.held = false;
      this.current = null;
      this.clearAtOnce();
    }
    transitions = transitions && !standby && this.dissolveMs > 0;
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
    const restarted = media?.startedAt !== this.current?.startedAt;
    this.current = media;
    for (const index of VIDEO_INDEXES) {
      if (this.holdsCurrent(index)) {
        this.applyProperties(index, media?.properties);
      }
    }
    if (unchanged) {
      if (suspended) this.pauseForStandby();
      else if (resumed) this.resume();
      else if (standby && restarted) {
        const target = this.handover?.to ?? this.front;
        this.cancelFrame(target);
        this.seekCurrent(this.videos[target]);
        this.prepareFrame(target);
      }
      return;
    }
    this.failed = false;
    this.cancelSpare();
    this.cancelSeek();
    if (media === null) this.clearAtOnce();
    else {
      if (standby) this.clearAtOnce();
      this.start(media);
    }
  }

  remaining(): number | undefined {
    const video = this.videos[this.front];
    return this.current === null || !Number.isFinite(video.duration)
      ? undefined
      : Math.max(0, video.duration - video.currentTime);
  }

  dispose(): void {
    this.cancelSpare();
    this.cancelSeek();
    this.stopListening();
    this.unloadAt(0);
    this.unloadAt(1);
    this.element.remove();
  }

  /** Adjusts the sound envelope without changing the picture or playback rate. */
  setAudioGain(gain: number): void {
    this.audioGain = Math.max(0, Math.min(1, gain));
    for (const index of VIDEO_INDEXES) {
      if (this.holdsCurrent(index)) {
        this.applyProperties(index, this.current?.properties);
      }
    }
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

  /** Moves the playing decoder while leaving its last picture on the old page. */
  moveTo(parent: HTMLElement): boolean {
    const picture = this.isImage(this.front)
      ? this.images[this.front]
      : this.videos[this.front];
    const width =
      picture instanceof HTMLVideoElement
        ? picture.videoWidth
        : picture.naturalWidth;
    const height =
      picture instanceof HTMLVideoElement
        ? picture.videoHeight
        : picture.naturalHeight;
    if (width > 0 && height > 0) {
      const snapshot = document.createElement('canvas');
      snapshot.dataset['mediaSnapshot'] = '';
      snapshot.width = width;
      snapshot.height = height;
      Object.assign(snapshot.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        objectFit: picture.style.objectFit,
      });
      try {
        const context = snapshot.getContext('2d');
        if (context === null) throw new Error('No media snapshot context');
        context.drawImage(picture, 0, 0);
        const outgoing = this.element.parentElement;
        outgoing?.querySelector('[data-media-snapshot]')?.remove();
        outgoing?.append(snapshot);
      } catch (error) {
        this.onError('could not retain the outgoing media picture', error);
        return false;
      }
    }
    parent.append(this.element);
    return true;
  }

  private start(media: MediaLayer): void {
    const to = otherOf(this.front);
    const video = this.videos[to];
    this.settleFront(to);
    this.load(to, media.mediaId);
    this.seekOnceLoaded(video, media);
    this.handover = {to, dissolve: this.transitions, contentChange: true};
    if (!this.standby) this.play(video);
  }

  private pauseForStandby(): void {
    this.cancelSpare();
    const target = this.handover?.to ?? this.front;
    for (const index of VIDEO_INDEXES) {
      if (index !== target) this.unloadAt(index);
      else this.videos[index].pause();
    }
    this.prepareFrame(target);
  }

  private prepareFrame(index: VideoIndex): void {
    const video = this.videos[index];
    if (
      (!this.standby && !this.atEnd()) ||
      !this.holdsCurrent(index) ||
      video.seeking ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return;
    }
    this.cancelFrame(index);
    this.decoded[index] = true;
    this.handlePlaying(index);
  }

  private resume(): void {
    if (this.current === null) return;
    const target = this.handover?.to ?? this.front;
    if (this.isImage(target)) return;
    const video = this.videos[target];
    this.cancelFrame(target);
    this.handover = {to: target, dissolve: false, contentChange: false};
    this.seekCurrent(video);
    if (this.atEnd()) {
      video.pause();
      this.prepareFrame(target);
    } else this.play(video);
  }

  private atEnd(): boolean {
    const media = this.current;
    const video = this.videos[this.handover?.to ?? this.front];
    return (
      media !== null &&
      !media.loop &&
      Number.isFinite(video.duration) &&
      video.duration > 0 &&
      backgroundElapsedSeconds(media, Date.now()) >= video.duration
    );
  }

  private seekCurrent(video: HTMLVideoElement): void {
    if (
      this.current !== null &&
      video.readyState >= HTMLMediaElement.HAVE_METADATA
    ) {
      video.currentTime = playbackOffsetSeconds(
        this.current,
        video.duration,
        Date.now(),
      );
    }
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
      const current =
        this.current?.mediaId === media.mediaId ? this.current : media;
      const offset = startOffsetSeconds(current, video.duration, Date.now());
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
    this.applyProperties(index, this.current?.properties);
    applySink(this.videos[index], this.sinkId, this.onError);
    this.videos[index].src = this.options.mediaUrl(mediaId);
    this.holding[index] = mediaId;
  }

  private applyProperties(
    index: VideoIndex,
    properties: OutputMediaProperties | undefined,
  ): void {
    const video = this.videos[index];
    const fit = properties?.fit ?? 'fill';
    const objectFit = mediaObjectFit(fit);
    video.style.objectFit = objectFit;
    this.images[index].style.objectFit = objectFit;
    try {
      video.playbackRate = properties?.speed ?? 1;
      video.volume = ((properties?.volume ?? 100) / 100) * this.audioGain;
      video.muted =
        this.standby ||
        (this.options.muted ?? true) ||
        properties?.audio !== true;
    } catch (error) {
      this.onError('could not apply background media properties', error);
    }
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
        if (this.held || this.standby || this.atEnd()) {
          video.pause();
          this.prepareFrame(at);
          return;
        }
        if (this.isImage(at)) return;
        if (!this.holdsCurrent(at)) return;
        if (typeof video.requestVideoFrameCallback === 'function') {
          this.cancelFrame(at);
          const source = this.holding[at];
          this.videoFrames[at] = video.requestVideoFrameCallback(() => {
            this.videoFrames[at] = null;
            if (this.holding[at] === source && this.holdsCurrent(at)) {
              this.clearFrameDeadline(at);
              this.decoded[at] = true;
              this.handlePlaying(at);
            }
          });
          this.frameDeadlines[at] = setTimeout(() => {
            this.frameDeadlines[at] = null;
            if (this.holding[at] !== source || !this.holdsCurrent(at)) return;
            if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
            this.cancelFrame(at);
            this.decoded[at] = true;
            this.handlePlaying(at);
          }, VIDEO_FRAME_DEADLINE_MS);
        } else {
          this.decoded[at] = true;
          this.handlePlaying(at);
        }
      };
      const onEnded = (): void => this.handleEnded(at);
      const onPrepared = (): void => this.prepareFrame(at);
      const onError = (): void => this.handleError(at);
      video.addEventListener('playing', onPlaying);
      video.addEventListener('ended', onEnded);
      video.addEventListener('error', onError);
      video.addEventListener('loadeddata', onPrepared);
      video.addEventListener('seeked', onPrepared);
      return [
        () => video.removeEventListener('playing', onPlaying),
        () => video.removeEventListener('ended', onEnded),
        () => video.removeEventListener('error', onError),
        () => video.removeEventListener('loadeddata', onPrepared),
        () => video.removeEventListener('seeked', onPrepared),
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
    if (index === this.front) {
      next.style.zIndex = FRONT_LAYER;
      next.classList.remove(classes.dissolving);
      next.classList.add(classes.shown);
      this.prepareSpareLater();
      return;
    }
    next.style.zIndex = FRONT_LAYER;
    previous.style.zIndex = BACK_LAYER;
    this.element.style.setProperty(
      '--background-dissolve',
      `${this.dissolveMs}ms`,
    );
    next.classList.toggle(classes.dissolving, dissolve);
    next.classList.add(classes.shown);
    this.front = index;
    if (dissolve) {
      this.spareTimer = setTimeout(
        () => this.finishDissolve(),
        this.dissolveMs,
      );
    } else {
      hide(previous);
      this.videos[otherOf(index)].pause();
      this.videos[otherOf(index)].currentTime = 0;
      if (!this.holdsCurrent(otherOf(index))) this.prepareSpareLater();
    }
  }

  private finishDissolve(): void {
    const outgoing = otherOf(this.front);
    this.hideAt(outgoing);
    this.videos[outgoing].pause();
    this.prepareSpareLater();
  }

  // NOTE(0913vision): Loading the spare video holds the output's frames for
  // about 50 ms while its decoder starts, so it waits until the new
  // background has played for a while instead of landing on the dissolve.
  private prepareSpareLater(): void {
    if (this.standby || this.atEnd()) return;
    this.spareTimer = setTimeout(() => this.prepareSpare(), SPARE_DELAY_MS);
  }

  private handleEnded(index: VideoIndex): void {
    if (this.held || this.standby) return;
    if (this.isImage(index)) return;
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
    this.onError('could not play a background video', detail);
  }

  private prepareSpare(): void {
    this.spareTimer = null;
    const spareIndex = otherOf(this.front);
    this.hideAt(spareIndex);
    if (this.current === null || this.isImage(this.front)) {
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
    if (this.standby) return;
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
      this.onError('could not start a background video', error);
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
        this.onError('could not load a background media file', {src});
      },
    });
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

  setDissolveMs(ms: number): void {
    this.view.setDissolveMs(ms);
  }

  show(media: MediaLayer | null, transitions = true, standby = false): void {
    if (this.view instanceof PlaybackBackgroundLayerView) {
      this.view.show(media, transitions, standby);
    } else this.view.show(media, transitions);
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
    return this.view.moveTo(parent);
  }

  dispose(): void {
    this.view.dispose();
  }
}
