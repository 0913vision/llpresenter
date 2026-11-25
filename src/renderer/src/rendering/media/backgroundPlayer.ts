import {classes} from '../classes';
import {loadBackgroundImage} from './backgroundImage';
import {VIDEO_FRAME_DEADLINE_MS} from './backgroundTiming';

const FRONT_LAYER = '1';
const BACK_LAYER = '0';

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
  element.classList.remove(classes.shown);
  element.style.zIndex = BACK_LAYER;
}

/**
 * One of the two players a background layer changes between: a reusable video,
 * and an image for a file the video cannot play. It keeps which media it holds
 * and whether its first picture has been drawn.
 */
export class BackgroundPlayer {
  readonly video = createVideo();
  readonly image = createImage();
  /** The media it holds, or null once unloaded. */
  holding: string | null = null;
  /** Whether its first picture is drawn, so it can take the front. */
  decoded = false;
  private frame: number | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private stopImage: (() => void) | null = null;

  /** Whether it shows its file as an image. */
  get isImage(): boolean {
    return this.image.hasAttribute('src');
  }

  /** The element that shows its picture. */
  get picture(): HTMLVideoElement | HTMLImageElement {
    return this.isImage ? this.image : this.video;
  }

  /** Puts its picture in front of the other player's, shown. */
  showInFront(): void {
    const {picture} = this;
    picture.style.zIndex = FRONT_LAYER;
    picture.classList.add(classes.shown);
  }

  hide(): void {
    hide(this.video);
    hide(this.image);
  }

  /** Stops loading its image, if any. */
  clearImage(): void {
    this.stopImage?.();
    this.stopImage = null;
  }

  /** Stops waiting for a first picture; it is not drawn then. */
  cancelFrame(): void {
    this.clearDeadline();
    if (this.frame !== null) this.video.cancelVideoFrameCallback(this.frame);
    this.frame = null;
    this.decoded = false;
  }

  /** Gives the video's decoder memory back, keeping what it holds. */
  releaseVideo(): void {
    // NOTE(0913vision): Removing the source and loading again gives the
    // decoder memory back (docs/TECH.md, memory).
    this.video.pause();
    this.video.loop = false;
    this.video.removeAttribute('src');
    this.video.load();
  }

  /** Lets go of everything it holds. */
  unload(): void {
    this.cancelFrame();
    this.clearImage();
    this.releaseVideo();
    this.holding = null;
  }

  /**
   * Waits for the video's first drawn frame, or for VIDEO_FRAME_DEADLINE_MS
   * once it has a frame to show, and tells `drawn` while it still holds the
   * same media and `wanted` says so.
   */
  awaitFirstFrame(wanted: () => boolean, drawn: () => void): void {
    const {video} = this;
    if (typeof video.requestVideoFrameCallback !== 'function') {
      this.decoded = true;
      drawn();
      return;
    }
    this.cancelFrame();
    const source = this.holding;
    const same = (): boolean => this.holding === source && wanted();
    this.frame = video.requestVideoFrameCallback(() => {
      this.frame = null;
      if (!same()) return;
      this.clearDeadline();
      this.decoded = true;
      drawn();
    });
    this.deadline = setTimeout(() => {
      this.deadline = null;
      if (!same()) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      this.cancelFrame();
      this.decoded = true;
      drawn();
    }, VIDEO_FRAME_DEADLINE_MS);
  }

  /**
   * Shows `src` as an image instead of the video: `shown` once it is decoded,
   * `failed` when it cannot load, both only while it is still that image.
   */
  showImage(
    src: string,
    {shown, failed}: {readonly shown: () => void; readonly failed: () => void},
  ): void {
    const {image} = this;
    let active = true;
    const current = (): boolean => active && image.getAttribute('src') === src;
    const fail = (): void => {
      if (current()) failed();
    };
    const stop = loadBackgroundImage(image, {
      src,
      onReady: () => {
        image.decode().then(() => {
          if (!current()) return;
          this.decoded = true;
          shown();
        }, fail);
      },
      onError: fail,
    });
    this.stopImage = () => {
      active = false;
      stop();
    };
  }

  private clearDeadline(): void {
    if (this.deadline !== null) clearTimeout(this.deadline);
    this.deadline = null;
  }
}
