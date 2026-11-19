import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {parsePictureRequest} from '@core/schema/picture';
import {fontsLoading, previewReady} from '../rendering/fontsLoading';
import {OutputRenderer} from '../rendering/outputRenderer';
import {openPreviewMedia} from '../rendering/previewMedia';
import {drawPicture} from '../rendering/pictures/drawPicture';

/** Installs the drawing entry point in the isolated painter page. */
export function startPainter(root: HTMLElement): void {
  const media = openPreviewMedia(window.llp);
  let previousTransparency: boolean | undefined;
  let source: OutputRenderer | undefined;
  let drawFailure: Error | undefined;
  Reflect.set(window, 'drawPicture', async (value: unknown): Promise<void> => {
    const parsed = parsePictureRequest(value);
    if (!parsed.ok) throw new Error(parsed.error.message);
    const {layers, appearance} = parsed.value.spec;
    const transparent = appearance.screen.method === 'ndi';
    drawFailure = undefined;
    if (source === undefined || previousTransparency !== transparent) {
      source?.dispose();
      source = new OutputRenderer(root, {
        transparent,
        textStyle: DEFAULT_TEXT_STYLE,
        mediaUrl,
        previewMedia: media,
        mode: 'preview',
        onError: (message, error) => console.error(message, error),
        onDrawFailure: (message, cause) => {
          drawFailure ??= new Error(message, {cause});
        },
      });
      previousTransparency = transparent;
      document.body.classList.toggle('ndi-transparent', transparent);
    }
    const renderer = source;
    try {
      drawPicture(renderer, root, {layers, appearance});
      await new Promise<void>((resolve, reject) => {
        let frame = 0;
        const timeout = setTimeout(() => {
          cancelAnimationFrame(frame);
          reject(drawFailure ?? new Error('Picture did not become ready'));
        }, OUTPUT_REVEAL_DEADLINE_MS);
        const finish = (): void => {
          clearTimeout(timeout);
          if (drawFailure === undefined) resolve();
          else reject(drawFailure);
        };
        const check = (): void => {
          if (drawFailure !== undefined) {
            finish();
          } else if (previewReady(renderer) && !fontsLoading(document.fonts)) {
            frame = requestAnimationFrame(() => {
              frame = requestAnimationFrame(finish);
            });
          } else {
            frame = requestAnimationFrame(check);
          }
        };
        check();
      });
    } catch (error) {
      source = undefined;
      renderer.dispose();
      throw error;
    }
  });
}
