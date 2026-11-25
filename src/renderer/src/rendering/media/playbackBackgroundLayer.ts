import type {MediaLayer} from '@core/schema/live/live';
import type {OutputMediaProperties} from '@core/schema/media/outputMedia';
import {mediaObjectFit} from '@core/media';
import {classes} from '../classes';
import {applySink} from './audioSink';
import {setPlaybackProblem} from './playbackProblem';
import type {BackgroundLayerOptions} from './backgroundLayer';
import {BackgroundPlayer} from './backgroundPlayer';
import {
  BACKGROUND_RELEASE_DELAY_MS,
  backgroundAtEnd,
  playbackOffsetSeconds,
  startOffsetSeconds,
} from './backgroundTiming';

const UNSUPPORTED_SOURCE = 4;

type PlayerIndex = 0 | 1;

const PLAYER_INDEXES: readonly PlayerIndex[] = [0, 1];

function otherOf(index: PlayerIndex): PlayerIndex {
  return index === 0 ? 1 : 0;
}

/**
 * Keeps two reusable players for background changes: the new background loads
 * in the player behind and takes the front once its first picture is drawn.
 * Only the current video loops; the other player unloads after the handover.
 */
export class PlaybackBackgroundLayerView {
  private readonly options: Omit<BackgroundLayerOptions, 'onError'>;
  private onError: BackgroundLayerOptions['onError'];
  private readonly element = document.createElement('div');
  private readonly players: readonly [BackgroundPlayer, BackgroundPlayer] = [
    new BackgroundPlayer(),
    new BackgroundPlayer(),
  ];
  private readonly stopListening: () => void;
  private front: PlayerIndex = 0;
  private current: MediaLayer | null = null;
  /** The player that is taking the front, until its first picture shows. */
  private handover: PlayerIndex | null = null;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;
  private stopWaitingToSeek: (() => void) | null = null;
  private failed = false;
  private held = false;
  private standby = false;
  private audioGain = 1;
  private sinkId = '';

  constructor(parent: HTMLElement, options: BackgroundLayerOptions) {
    const {onError, ...playback} = options;
    this.options = playback;
    this.onError = onError;
    this.element.className = classes.layer;
    this.element.append(
      ...this.players.map(player => player.video),
      ...this.players.map(player => player.image),
    );
    this.stopListening = this.listen();
    parent.append(this.element);
  }

  /**
   * Plays the sound of both videos to a device (an empty id is the Windows
   * default); a video that starts later keeps the device.
   */
  setSink(sinkId: string): void {
    this.sinkId = sinkId;
    for (const player of this.players) {
      applySink(player.video, sinkId, this.onError);
    }
  }

  /** Rebinds reports when a retained player changes its owning theme element. */
  setOnError(onError: BackgroundLayerOptions['onError']): void {
    this.onError = onError;
  }

  /**
   * Starts the background, or clears the layer at once for null. The same
   * media again keeps playing without a restart (docs/spec/03-output.md).
   */
  show(media: MediaLayer | null, standby = false): void {
    const resumed = this.standby && !standby;
    const suspended = !this.standby && standby;
    this.standby = standby;
    if (this.held) {
      this.held = false;
      this.current = null;
      this.clearAtOnce();
    }
    const unchanged = media?.mediaId === this.current?.mediaId;
    const restarted = media?.startedAt !== this.current?.startedAt;
    this.current = media;
    for (const index of PLAYER_INDEXES) {
      if (this.holdsCurrent(index)) {
        this.applyProperties(index, media?.properties);
      }
    }
    if (unchanged) {
      if (suspended) this.pauseForStandby();
      else if (resumed) this.resume();
      else if (standby && restarted) {
        const target = this.handover ?? this.front;
        this.players[target].cancelFrame();
        this.seekCurrent(this.players[target].video);
        this.prepareFrame(target);
      }
      return;
    }
    this.failed = false;
    setPlaybackProblem(this.element, 'playback', false);
    this.cancelRelease();
    this.cancelSeek();
    if (media === null) this.clearAtOnce();
    else {
      if (standby) this.clearAtOnce();
      this.start(media);
    }
  }

  remaining(): number | undefined {
    const {video} = this.players[this.front];
    return this.current === null || !Number.isFinite(video.duration)
      ? undefined
      : Math.max(
          0,
          (this.current.properties?.out ?? video.duration) - video.currentTime,
        );
  }

  dispose(): void {
    this.cancelRelease();
    this.cancelSeek();
    this.stopListening();
    for (const player of this.players) player.unload();
    this.element.remove();
  }

  /** Adjusts the sound envelope without changing the picture or playback rate. */
  setAudioGain(gain: number): void {
    this.audioGain = Math.max(0, Math.min(1, gain));
    for (const index of PLAYER_INDEXES) {
      if (this.holdsCurrent(index)) {
        this.applyProperties(index, this.current?.properties);
      }
    }
  }

  /** Freezes the cleared frame until its explicit fade finishes or is restored. */
  hold(): void {
    if (this.held) return;
    this.held = true;
    this.cancelRelease();
    this.cancelSeek();
    for (const player of this.players) player.video.pause();
  }

  ready(): boolean {
    return (
      this.current === null ||
      this.failed ||
      (this.handover === null &&
        this.holdsCurrent(this.front) &&
        this.players[this.front].decoded)
    );
  }

  /** Moves the playing decoder while leaving its last picture on the old page. */
  moveTo(parent: HTMLElement): boolean {
    const picture = this.players[this.front].picture;
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
    this.players[this.front].video.loop = false;
    const to = otherOf(this.front);
    const {video} = this.players[to];
    this.players[to].hide();
    this.load(to, media.mediaId);
    this.seekOnceLoaded(video, media);
    this.handover = to;
    if (!this.standby) this.play(video);
  }

  private pauseForStandby(): void {
    this.cancelRelease();
    const target = this.handover ?? this.front;
    for (const index of PLAYER_INDEXES) {
      if (index !== target) this.players[index].unload();
      else this.players[index].video.pause();
    }
    this.prepareFrame(target);
  }

  private prepareFrame(index: PlayerIndex): void {
    const player = this.players[index];
    if (
      (!this.standby && !this.atEnd()) ||
      !this.holdsCurrent(index) ||
      player.video.seeking ||
      player.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return;
    }
    player.cancelFrame();
    player.decoded = true;
    this.handlePlaying(index);
  }

  private resume(): void {
    if (this.current === null) return;
    const target = this.handover ?? this.front;
    const player = this.players[target];
    if (player.isImage) return;
    player.cancelFrame();
    this.handover = target;
    this.seekCurrent(player.video);
    if (this.atEnd()) {
      player.video.pause();
      this.prepareFrame(target);
    } else this.play(player.video);
  }

  private atEnd(): boolean {
    const {video} = this.players[this.handover ?? this.front];
    return backgroundAtEnd(this.current, video.duration, Date.now());
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
    for (const player of this.players) player.hide();
    for (const player of this.players) player.unload();
  }

  private load(index: PlayerIndex, mediaId: string): void {
    const player = this.players[index];
    player.cancelFrame();
    player.clearImage();
    this.applyProperties(index, this.current?.properties);
    applySink(player.video, this.sinkId, this.onError);
    player.video.src = this.options.mediaUrl(mediaId);
    player.holding = mediaId;
  }

  private applyProperties(
    index: PlayerIndex,
    properties: OutputMediaProperties | undefined,
  ): void {
    const {video, image} = this.players[index];
    const objectFit = mediaObjectFit(properties?.fit ?? 'fill');
    video.style.objectFit = objectFit;
    image.style.objectFit = objectFit;
    try {
      video.loop =
        this.current?.loop === true &&
        properties?.in === undefined &&
        properties?.out === undefined;
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

  private holdsCurrent(index: PlayerIndex): boolean {
    return (
      this.current !== null &&
      this.players[index].holding === this.current.mediaId
    );
  }

  private listen(): () => void {
    const removers = PLAYER_INDEXES.flatMap(at => {
      const player = this.players[at];
      const {video} = player;
      const onPlaying = (): void => {
        if (this.held || this.standby || this.atEnd()) {
          video.pause();
          this.prepareFrame(at);
          return;
        }
        if (player.isImage) return;
        if (!this.holdsCurrent(at)) return;
        player.awaitFirstFrame(
          () => this.holdsCurrent(at),
          () => this.handlePlaying(at),
        );
      };
      const onEnded = (): void => this.handleEnded(at);
      const onPrepared = (): void => this.prepareFrame(at);
      const onError = (): void => this.handleError(at);
      const onTimeUpdate = (): void => {
        const media = this.current;
        if (
          media === null ||
          !this.holdsCurrent(at) ||
          this.held ||
          this.standby
        ) {
          return;
        }
        const end = media.properties?.out;
        if (end === undefined || video.currentTime < end) return;
        if (media.loop) video.currentTime = media.properties?.in ?? 0;
        else {
          video.currentTime = end;
          video.pause();
        }
      };
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('playing', onPlaying);
      video.addEventListener('ended', onEnded);
      video.addEventListener('error', onError);
      video.addEventListener('loadeddata', onPrepared);
      video.addEventListener('seeked', onPrepared);
      return [
        () => video.removeEventListener('timeupdate', onTimeUpdate),
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

  private handlePlaying(index: PlayerIndex): void {
    if (this.held) return;
    if (this.handover !== index) return;
    setPlaybackProblem(this.element, 'playback', false);
    this.handover = null;
    const previous = this.players[this.front];
    this.players[index].showInFront();
    if (index === this.front) {
      this.releasePreviousLater();
      return;
    }
    this.front = index;
    previous.hide();
    const spare = this.players[otherOf(index)].video;
    spare.pause();
    spare.currentTime = 0;
    if (!this.holdsCurrent(otherOf(index))) this.releasePreviousLater();
  }

  private releasePreviousLater(): void {
    if (this.standby || this.atEnd()) return;
    this.cancelRelease();
    this.releaseTimer = setTimeout(
      () => this.releasePrevious(),
      BACKGROUND_RELEASE_DELAY_MS,
    );
  }

  private handleEnded(index: PlayerIndex): void {
    if (this.held || this.standby) return;
    if (this.players[index].isImage) return;
    // NOTE(0913vision): An outgoing background that ends while the next one
    // starts holds its last frame; only the current background loops.
    if (index !== this.front || !this.holdsCurrent(index)) return;
    if (this.current?.loop !== true) return;
    this.restart(this.players[index].video);
  }

  private handleError(index: PlayerIndex): void {
    const player = this.players[index];
    if (player.isImage) return;
    const {video} = player;
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

  private releasePrevious(): void {
    this.releaseTimer = null;
    const spare = this.players[otherOf(this.front)];
    spare.hide();
    spare.unload();
  }

  private restart(video: HTMLVideoElement): void {
    video.currentTime = this.current?.properties?.in ?? 0;
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
      const index: PlayerIndex = video === this.players[0].video ? 0 : 1;
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

  /**
   * Shows the file of a player that is taking the front as an image, when its
   * video cannot play it.
   *
   * @returns Whether the player shows or loads it as an image.
   */
  private tryImage(index: PlayerIndex): boolean {
    if (this.handover !== index || !this.holdsCurrent(index)) return false;
    const player = this.players[index];
    if (player.isImage) return true;
    const src = player.video.getAttribute('src');
    if (src === null) return false;
    player.cancelFrame();
    this.cancelSeek();
    player.releaseVideo();
    player.showImage(src, {
      shown: () => this.handlePlaying(index),
      failed: () => {
        this.fail(index);
        this.onError('could not load a background media file', {src});
      },
    });
    return true;
  }

  private fail(index: PlayerIndex): void {
    if (!this.holdsCurrent(index)) return;
    if (this.handover !== index && this.front !== index) return;
    this.failed = true;
    setPlaybackProblem(this.element, 'playback', true);
    this.handover = null;
    this.cancelRelease();
    this.cancelSeek();
    const player = this.players[index];
    if (index === this.front && player.decoded) {
      player.video.pause();
      return;
    }
    player.hide();
    player.unload();
    const front = this.players[this.front];
    if (index !== this.front && !front.decoded) {
      front.hide();
      front.unload();
    }
  }

  private cancelRelease(): void {
    if (this.releaseTimer === null) return;
    clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
  }
}
