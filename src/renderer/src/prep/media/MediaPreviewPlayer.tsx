import {useEffect, useRef, useState, type JSX} from 'react';
import {mediaUrl} from '@contracts/ipc/media';
import type {MediaItem} from '@core/schema/mediaList';
import {Icon} from '@renderer/ui/Icon';
import {IconButton} from '@renderer/ui/IconButton';
import {MissingFileMark} from '@renderer/ui/MissingFile';
import {TruncatedText} from '@renderer/ui/TruncatedText';
import {durationText} from './mediaEntries';
import {DEFAULT_SPEED, MIN_SPEED, MAX_SPEED, shownProps} from './mediaProps';
import styles from './MediaPreviewPlayer.module.css';

const AUDIO_ICON_SIZE = 28;
const MAX_VOLUME = 100;

export interface MediaPreviewPlayerProps {
  readonly item: MediaItem;
  readonly missing: boolean;
  /** 파일 위치 열기. */
  readonly onReveal: () => void;
}

function release(element: HTMLMediaElement | null): void {
  if (element === null) return;
  element.pause();
  element.removeAttribute('src');
  element.load();
}

function applyPlaybackRate(element: HTMLMediaElement, speed: number): void {
  const rate = Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
  try {
    element.playbackRate = rate;
  } catch (error: unknown) {
    console.warn('Could not set the media preview playback rate', error);
    if (rate === DEFAULT_SPEED) return;
    try {
      element.playbackRate = DEFAULT_SPEED;
    } catch (fallbackError: unknown) {
      console.warn(
        'Could not reset the media preview playback rate',
        fallbackError,
      );
    }
  }
}

/**
 * The preview player above the media properties (spec 05, "Media view"):
 * the picture, a play button with the position and the time left, the name,
 * the file, and 파일 위치 열기. It plays the item's range with its end rule,
 * speed, and sound, only in this window, so it never touches the output.
 * Mount it with the item's id as its key; it lets go of the file on unmount.
 */
export function MediaPreviewPlayer({
  item,
  missing,
  onReveal,
}: MediaPreviewPlayerProps): JSX.Element {
  const media = useRef<HTMLMediaElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const shown = shownProps(item);
  const [position, setPosition] = useState(shown.start);
  const stop = shown.stop;
  const source = mediaUrl(item.id);
  useEffect(() => {
    const element = media.current;
    if (element !== null && element.getAttribute('src') !== source) {
      element.setAttribute('src', source);
      element.load();
    }
    return () => {
      release(element);
    };
  }, [item.kind, missing, source]);
  useEffect(() => {
    const element = media.current;
    if (element === null) return;
    element.muted = !shown.audio;
    element.volume = shown.volume / MAX_VOLUME;
    applyPlaybackRate(element, shown.speed);
  }, [item.kind, missing, shown.audio, shown.volume, shown.speed]);
  const failed = (error: unknown): void => {
    console.warn('Could not play the media preview', error);
    setPlaying(false);
  };
  const toggle = (): void => {
    const element = media.current;
    if (element === null) return;
    if (playing) {
      element.pause();
      return;
    }
    if (
      element.currentTime < shown.start ||
      (stop !== undefined && element.currentTime >= stop)
    ) {
      element.currentTime = shown.start;
    }
    element.play().catch(failed);
  };
  const follow = (element: HTMLMediaElement): void => {
    const time = element.currentTime;
    if (stop !== undefined && time >= stop) {
      if (shown.end === 'loop') element.currentTime = shown.start;
      else element.pause();
    }
    setPosition(element.currentTime);
  };
  const playable = item.kind !== 'image' && !missing;
  const events = {
    ref: (element: HTMLMediaElement | null) => {
      media.current = element;
    },
    src: source,
    preload: 'metadata',
    onLoadedMetadata: () => {
      const element = media.current;
      if (element !== null) element.currentTime = shown.start;
      setPlaying(false);
    },
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => {
      const element = media.current;
      if (element === null) return;
      if (shown.end === 'loop') {
        element.currentTime = shown.start;
        element.play().catch(failed);
      } else setPlaying(false);
    },
    onTimeUpdate: () => {
      if (media.current !== null) follow(media.current);
    },
  } as const;
  return (
    <div className={styles.player}>
      <div className={styles.screen}>
        {missing ? (
          <MissingFileMark />
        ) : item.kind === 'video' ? (
          <video {...events} className={styles.picture} playsInline />
        ) : item.kind === 'image' ? (
          <img className={styles.picture} src={mediaUrl(item.id)} alt="" />
        ) : (
          <>
            <Icon
              name="audio"
              size={AUDIO_ICON_SIZE}
              className={styles.sound}
            />
            <audio {...events} />
          </>
        )}
      </div>
      {item.kind === 'image' ? null : (
        <div className={styles.transport}>
          <IconButton
            icon={playing ? 'pause' : 'play'}
            label={playing ? '일시 정지' : '재생'}
            disabled={!playable}
            title={missing ? '파일을 찾을 수 없음' : undefined}
            onClick={toggle}
          />
          <span className={styles.time}>{durationText(position)}</span>
          {stop === undefined ? null : (
            <span className={styles.left}>
              {`${durationText(Math.max(0, stop - position))} 남음`}
            </span>
          )}
        </div>
      )}
      <div className={styles.file}>
        <span className={styles.lines}>
          <TruncatedText text={item.name} className={styles.name} />
          <TruncatedText text={item.file} className={styles.path} />
        </span>
        <IconButton
          icon="folderopen"
          label="파일 위치 열기"
          disabled={missing}
          title={missing ? '파일을 찾을 수 없음' : undefined}
          onClick={onReveal}
        />
      </div>
    </div>
  );
}
