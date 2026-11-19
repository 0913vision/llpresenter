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
import {
  pictures,
  type PictureDisplay,
  type PictureImage,
  type PictureService,
  type PictureSpec,
} from './pictureService';
import {
  followSongPictureDraft,
  songPictureDraft,
} from '@core/presentation/songPictureDrafts';
import styles from './Picture.module.css';

interface PictureProps extends PictureSpec {
  readonly service?: PictureService | undefined;
  /** Keeps the previous view until the new picture finishes decoding. */
  readonly wait?: boolean;
  readonly switchSlot?: string | undefined;
  readonly editing?: boolean;
}

function SlideImage({
  source,
  canvasMode,
  prepared,
  ticket,
}: {
  readonly source: PictureImage['source'];
  readonly canvasMode: boolean;
  readonly prepared?: HTMLImageElement | undefined;
  readonly ticket: Pick<
    ReturnType<PictureService['request']>,
    'image' | 'subscribe'
  >;
}): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const still = useRef<HTMLImageElement>(null);
  const painted = useRef<
    {node: HTMLCanvasElement; image: CanvasImageSource} | undefined
  >(undefined);
  useLayoutEffect(() => {
    const node = canvas.current;
    const image =
      typeof source === 'string' ? (prepared ?? still.current) : source;
    if (node === null || image === null) return;
    const draw = (image: HTMLImageElement | HTMLCanvasElement): void => {
      if (
        image instanceof HTMLImageElement &&
        (!image.complete || image.naturalWidth === 0)
      ) {
        return;
      }
      if (painted.current?.node === node && painted.current.image === image) {
        return;
      }
      const context = node.getContext('2d');
      if (context === null) return;
      context.clearRect(0, 0, node.width, node.height);
      context.drawImage(image, 0, 0, node.width, node.height);
      painted.current = {node, image};
    };
    const seed = (): void => {
      const source = ticket.image?.source;
      draw(source instanceof HTMLCanvasElement ? source : image);
    };
    seed();
    image.addEventListener('load', seed);
    const stop = ticket.subscribe(() => {
      const source = ticket.image?.source;
      if (source instanceof HTMLCanvasElement) draw(source);
    });
    return () => {
      stop();
      image.removeEventListener('load', seed);
    };
  }, [source, canvasMode, prepared, ticket]);
  return (
    <>
      {canvasMode || typeof source !== 'string' ? (
        <canvas
          ref={canvas}
          className={
            canvasMode ? `${styles.image} ${styles.editorCanvas}` : styles.image
          }
          width={1920}
          height={1080}
          aria-hidden="true"
        />
      ) : null}
      {typeof source === 'string' && prepared === undefined ? (
        <img
          ref={still}
          className={styles.image}
          src={source}
          alt=""
          decoding="async"
          draggable={false}
        />
      ) : null}
    </>
  );
}

/** Displays a shared still, keeping the last decoded image during redraws. */
export const Picture = memo(
  ({
    wait = false,
    service = pictures,
    switchSlot,
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
    const inputs = useSyncExternalStore(service.subscribeInputs, () =>
      service.inputs(spec),
    );
    const [previous, setPrevious] = useState<PictureImage>();
    const [displayed, setDisplayed] = useState<PictureDisplay>();
    const ticket = service.request(spec, inputs, {
      editing: (editing || draft !== undefined) && previous !== undefined,
    });
    useSyncExternalStore(ticket.subscribe, ticket.snapshot);
    const done = ticket.done;
    const image = ticket.image ?? previous;
    // NOTE(0913vision): Chromium can update pixels of a mounted canvas in
    // the current paint. Mounting a new canvas there would cost another frame.
    const canvasMode = editing || draft !== undefined;
    const attached = displayed?.picture === image ? displayed : undefined;
    const prepared =
      attached === undefined && switchSlot !== undefined && ticket.available
        ? service.prepareDisplay(ticket, switchSlot)
        : undefined;
    const display = attached ?? prepared?.display;
    const host = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
      if (display === undefined) return;
      const {element} = display;
      host.current?.append(element);
      display.consume();
      return () => element.remove();
    }, [display]);
    const onReady = useContext(PictureReadiness);
    const source = useRef({});
    const warmEditor = useEffectEvent(() => service.warmEditor(spec));
    useLayoutEffect(() => {
      if (editing) warmEditor();
    }, [editing]);
    useLayoutEffect(() => {
      if (done) onReady?.(source.current);
    }, [done, onReady]);
    useLayoutEffect(
      () => (image === undefined ? undefined : service.retain(image)),
      [image, service],
    );
    // NOTE(0913vision): Run every hook before a render waits for its picture.
    if (prepared !== undefined && !prepared.done) use(prepared.ready);
    else if (wait && ticket.available && !done) use(ticket.ready);
    if (image !== previous) setPrevious(image);
    if (display !== displayed) setDisplayed(display);
    return (
      <div
        ref={host}
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
        {image === undefined ||
        (display !== undefined && !canvasMode) ? null : (
          <SlideImage
            source={image.source}
            canvasMode={canvasMode}
            prepared={display?.element}
            ticket={ticket}
          />
        )}
      </div>
    );
  },
  (previous, next) =>
    previous.service === next.service &&
    previous.wait === next.wait &&
    previous.switchSlot === next.switchSlot &&
    previous.editing === next.editing &&
    previous.songSource?.songId === next.songSource?.songId &&
    previous.songSource?.slideId === next.songSource?.slideId &&
    previous.appearance.checker === next.appearance.checker &&
    pictureKey(previous) === pictureKey(next),
);
