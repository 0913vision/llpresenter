import {memo, useLayoutEffect, useRef, type JSX} from 'react';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {pictureKey} from '@core/output/pictureKey';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {OutputRenderer} from '../outputRenderer';
import {openPreviewMedia} from '../previewMedia';
import {drawPicture, layoutPicture} from './drawPicture';
import {pictures, type PictureSpec} from './pictureService';
import styles from './Picture.module.css';

/** Shows the requested composition in its tile while its still is decoded. */
export const ComposedPicture = memo(
  ({spec}: {readonly spec: PictureSpec}): JSX.Element => {
    const host = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
      const node = host.current;
      if (node === null) return;
      const {appearance} = spec;
      const media = openPreviewMedia(window.llp);
      layoutPicture(node, pictures.screenSize(appearance.screen));
      const renderer = new OutputRenderer(node, {
        textStyle: DEFAULT_TEXT_STYLE,
        transparent: appearance.screen.method === 'ndi',
        ...(appearance.biblePreview === undefined
          ? {}
          : {biblePreview: {...appearance.biblePreview, hideGuide: true}}),
        mediaUrl,
        previewMedia: media,
        mode: 'preview',
        onError: (message, error) => console.error(message, error),
      });
      drawPicture(renderer, node, spec);
      renderer.revealIncomplete();
      return () => {
        renderer.dispose();
        media?.dispose();
      };
    }, [spec]);
    return (
      <div
        className={`${styles.screen} ${styles.composed}`}
        aria-hidden="true"
        data-composed-picture=""
      >
        <div className={styles.composedViewport}>
          <div ref={host} />
        </div>
      </div>
    );
  },
  (previous, next) => pictureKey(previous.spec) === pictureKey(next.spec),
);
