import {
  memo,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type JSX,
} from 'react';
import {THEME_LIMITS} from '@core/themes/elementRules';
import {useScreenSize} from './screenSizes';
import {classNames} from '@renderer/ui/classNames';
import {
  slideStillSpec,
  type SlideInput,
} from '@renderer/rendering/slideStillSpec';
import {
  SlideStill,
  type StillOptions,
  type StillPicture,
} from '@renderer/rendering/slideStill';
import styles from './SlidePicture.module.css';

interface StillProps extends StillPicture {
  readonly options?: StillOptions | undefined;
  readonly className?: string | undefined;
}

interface FrameStyle extends CSSProperties {
  readonly '--picture-width': number;
  readonly '--picture-height': number;
}

function stillKey({layers, appearance, options}: StillProps): string {
  const {theme, audience, ...screen} = appearance;
  return JSON.stringify([
    layers,
    screen,
    options,
    {...theme, layout: null},
    audience === undefined
      ? null
      : {...audience, theme: {...audience.theme, layout: null}},
  ]);
}

/**
 * A slide exactly as its screen shows it, drawn in place: thumbnails, previews
 * and editors all use it, and it never shows another slide's picture.
 */
export const Still = memo(
  ({layers, appearance, options, className}: StillProps): JSX.Element => {
    const host = useRef<HTMLDivElement>(null);
    const still = useRef<SlideStill | null>(null);
    const elementId = options?.biblePreview?.elementId;
    const maxLines = options?.biblePreview?.maxLines;
    useLayoutEffect(() => {
      if (host.current === null) return;
      const drawing = new SlideStill(
        host.current,
        elementId === undefined || maxLines === undefined
          ? {}
          : {biblePreview: {elementId, maxLines}},
      );
      still.current = drawing;
      return () => {
        still.current = null;
        drawing.dispose();
      };
    }, [elementId, maxLines]);
    useLayoutEffect(() => {
      still.current?.draw({layers, appearance});
    });
    const {screen, background} = appearance;
    const size = useScreenSize(screen.id, screen.pictureSize) ?? THEME_LIMITS;
    const style: FrameStyle = {
      '--picture-width': size.width,
      '--picture-height': size.height,
      background: screen.method === 'ndi' ? 'transparent' : background,
    };
    return (
      <div className={classNames(styles.screen, className)} aria-hidden="true">
        <div ref={host} className={styles.frame} style={style} />
      </div>
    );
  },
  (previous, next) =>
    previous.appearance.theme.layout === next.appearance.theme.layout &&
    previous.appearance.audience?.theme.layout ===
      next.appearance.audience?.theme.layout &&
    previous.className === next.className &&
    stillKey(previous) === stillKey(next),
);

/** A slide whose screen and theme are resolved. */
export function SlidePicture(input: SlideInput): JSX.Element {
  return <Still {...slideStillSpec(input)} />;
}
