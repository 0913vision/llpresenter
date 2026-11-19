import type {PictureRequest} from '@core/schema/picture';
import type {OutputRenderer} from '../outputRenderer';

export const PICTURE_WIDTH = 1920;
export const PICTURE_HEIGHT = 1080;

/** Fits an output's aspect ratio inside the shared still-picture canvas. */
export function pictureBounds(
  size: {readonly width: number; readonly height: number} | undefined,
) {
  if (size === undefined) {
    return {x: 0, y: 0, width: PICTURE_WIDTH, height: PICTURE_HEIGHT};
  }
  const scale = Math.min(
    PICTURE_WIDTH / size.width,
    PICTURE_HEIGHT / size.height,
  );
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  return {
    x: Math.floor((PICTURE_WIDTH - width) / 2),
    y: Math.floor((PICTURE_HEIGHT - height) / 2),
    width,
    height,
  };
}

/** Sizes the output renderer before a picture is drawn. */
export function layoutPicture(
  host: HTMLElement,
  size: {readonly width: number; readonly height: number} | undefined,
) {
  const bounds = pictureBounds(size);
  Object.assign(host.style, {
    position: 'absolute',
    left: `${bounds.x}px`,
    top: `${bounds.y}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  });
  return bounds;
}

/** Composes a still using the same output renderer in every picture host. */
export function drawPicture(
  renderer: OutputRenderer,
  host: HTMLElement,
  {layers, appearance}: PictureRequest['spec'],
): void {
  host.style.background =
    appearance.screen.method === 'ndi' ? 'transparent' : appearance.background;
  renderer.render(layers, {
    screen: appearance.screen,
    theme: appearance.theme,
    ...(appearance.audience === undefined
      ? {}
      : {audience: appearance.audience}),
    ...(appearance.stageLyricLabelPosition === undefined
      ? {}
      : {stageLyricLabelPosition: appearance.stageLyricLabelPosition}),
    transitions: false,
    standby: true,
    ...(layers.slide === null ? {} : {slide: layers.slide}),
  });
}
