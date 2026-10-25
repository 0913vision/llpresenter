import {useEffect, useRef, type JSX} from 'react';
import {mediaUrl} from '@shared/media';
import type {MediaItem} from '@shared/schema/mediaList';
import styles from './ShowMediaPanel.module.css';

/** A still preview owned by a rendered strip tile, released when it leaves view. */
export function MediaPreview({
  item,
  onError,
}: {
  readonly item: MediaItem;
  readonly onError: () => void;
}): JSX.Element {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    return () => {
      if (!element) return;
      element.pause();
      element.removeAttribute('src');
      element.load();
    };
  }, []);
  return item.kind === 'image' ? (
    <img
      className={styles.preview}
      src={mediaUrl(item.id)}
      alt=""
      decoding="async"
      onError={onError}
    />
  ) : (
    <video
      ref={video}
      className={styles.preview}
      src={mediaUrl(item.id)}
      muted
      preload="metadata"
      aria-hidden="true"
      onError={onError}
    />
  );
}
