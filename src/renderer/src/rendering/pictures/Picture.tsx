import {
  memo,
  use,
  useCallback,
  useContext,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import {PictureReadiness} from '../PictureReadiness';
import {pictureKey} from '@core/output/pictureKey';
import {pictures, type PictureImage, type PictureSpec} from './pictureService';
import {
  followSongPictureDraft,
  songPictureDraft,
} from '@core/presentation/songPictureDrafts';
import styles from './Picture.module.css';

interface PictureProps extends PictureSpec {
  /** Keeps the previous view until the new picture finishes decoding. */
  readonly wait?: boolean;
  readonly editing?: boolean;
}

function SlideImage({
  source,
}: {
  readonly source: PictureImage['source'];
}): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (typeof source !== 'string') {
      canvas.current?.getContext('2d')?.drawImage(source, 0, 0);
    }
  }, [source]);
  return typeof source === 'string' ? (
    <img
      className={styles.image}
      src={source}
      alt=""
      decoding="async"
      draggable={false}
    />
  ) : (
    <canvas
      ref={canvas}
      className={styles.image}
      width={1920}
      height={1080}
      aria-hidden="true"
    />
  );
}

/** Displays a shared still, keeping the last decoded image during redraws. */
export const Picture = memo(
  ({
    wait = false,
    editing = false,
    layers,
    appearance,
    songSource,
  }: PictureProps): JSX.Element => {
    const follow = useCallback(
      (listener: () => void) => followSongPictureDraft(songSource, listener),
      [songSource],
    );
    const draft = useSyncExternalStore(follow, () =>
      songPictureDraft(songSource, layers.slide?.lines),
    );
    const spec = {
      appearance,
      layers:
        layers.slide === null || draft === undefined
          ? layers
          : {
              ...layers,
              slide: {...layers.slide, lines: draft.lines},
            },
    };
    const inputs = useSyncExternalStore(pictures.subscribeInputs, () =>
      pictures.inputs(spec),
    );
    const [previous, setPrevious] = useState<PictureImage>();
    const ticket = pictures.request(spec, inputs, {
      editing: (editing || draft !== undefined) && previous !== undefined,
    });
    useSyncExternalStore(ticket.subscribe, ticket.snapshot);
    const done = ticket.done;
    if (wait && ticket.available && !done) use(ticket.ready);
    const image = ticket.image ?? previous;
    if (image !== previous) setPrevious(image);
    const onReady = useContext(PictureReadiness);
    const source = useRef({});
    const warmEditor = useEffectEvent(() => pictures.warmEditor(spec));
    useLayoutEffect(() => {
      if (editing) warmEditor();
    }, [editing]);
    useLayoutEffect(() => {
      if (done) onReady?.(source.current);
    }, [done, onReady]);
    useLayoutEffect(
      () => (image === undefined ? undefined : pictures.retain(image)),
      [image],
    );
    return (
      <div
        className={styles.screen}
        data-preview-ready={ticket.available ? String(done) : undefined}
        style={{
          background:
            appearance.screen.method === 'ndi'
              ? 'transparent'
              : appearance.background,
        }}
        data-checker={appearance.checker || undefined}
      >
        {image === undefined ? null : <SlideImage source={image.source} />}
      </div>
    );
  },
  (previous, next) =>
    previous.wait === next.wait &&
    previous.editing === next.editing &&
    previous.songSource?.songId === next.songSource?.songId &&
    previous.songSource?.slideId === next.songSource?.slideId &&
    previous.appearance.checker === next.appearance.checker &&
    pictureKey(previous) === pictureKey(next),
);
