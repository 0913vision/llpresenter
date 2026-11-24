import {
  memo,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type JSX,
} from 'react';
import {sameJson} from '@core/common/sameJson';
import {backgroundColorOf} from '@renderer/rendering/theme/themeBackground';
import {SlideStill} from '@renderer/rendering/slideStill';
import {classNames} from '@renderer/ui/classNames';
import type {SlideDrawing} from './slideDrawing';
import {useScreenSize} from './screenSizes';
import styles from './SlidePicture.module.css';
import {THEME_CANVAS} from '@core/schema/screens/screens';
import type {ThemeDrawing} from '@renderer/rendering/theme/shownTexts';

interface SlidePictureProps extends SlideDrawing {
  readonly className?: string | undefined;
}

interface FrameStyle extends CSSProperties {
  readonly '--picture-width': number;
  readonly '--picture-height': number;
}

function sameDrawing(a: ThemeDrawing | null, b: ThemeDrawing | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  const {theme, screen, ...rest} = a;
  const {theme: _theme, screen: _screen, ...other} = b;
  return theme === b.theme && screen === b.screen && sameJson(rest, other);
}

/**
 * A slide exactly as its screen shows it, drawn in place: thumbnails, previews
 * and editors all use it, and nothing in it is drawn any other way.
 */
export const SlidePicture = memo(
  ({drawing, screen, className}: SlidePictureProps): JSX.Element => {
    const host = useRef<HTMLDivElement>(null);
    const still = useRef<SlideStill | null>(null);
    useLayoutEffect(() => {
      if (host.current === null) return;
      const picture = new SlideStill(host.current);
      still.current = picture;
      return () => {
        still.current = null;
        picture.dispose();
      };
    }, []);
    useLayoutEffect(() => {
      still.current?.draw(drawing);
    });
    const size = useScreenSize(screen.id, screen.pictureSize) ?? THEME_CANVAS;
    const style: FrameStyle = {
      '--picture-width': size.width,
      '--picture-height': size.height,
      background:
        screen.method === 'ndi'
          ? 'transparent'
          : (drawing?.screen.backdrop ??
            backgroundColorOf(drawing?.background) ??
            screen.emptyColor),
    };
    return (
      <div className={classNames(styles.screen, className)} aria-hidden="true">
        <div ref={host} className={styles.frame} style={style} />
      </div>
    );
  },
  (previous, next) =>
    previous.className === next.className &&
    sameJson(previous.screen, next.screen) &&
    sameDrawing(previous.drawing, next.drawing),
);
