import type {PictureRequest} from '@core/schema/picture';
import type {OutputRenderer} from '../outputRenderer';

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
    transitions: false,
    standby: true,
    ...(layers.slide === null ? {} : {slide: layers.slide}),
  });
}
