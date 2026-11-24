import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {previewMediaOf} from './media/previewMedia';
import {ThemeView} from './theme/themeView';
import {type ThemeDrawing} from './theme/shownTexts';

const open = new Set<SlideStill>();
let following = false;

/** Text drawn before its font was there is laid out again with it. */
function followFonts(): void {
  if (following || typeof document.fonts === 'undefined') return;
  following = true;
  document.fonts.addEventListener('loadingdone', () => {
    for (const still of open) still.refit();
  });
}

/** One slide drawn in place, by the drawing of the output. */
export class SlideStill {
  private readonly view: ThemeView;

  constructor(host: HTMLElement) {
    this.view = new ThemeView(host, {
      mediaUrl,
      previewMedia: previewMediaOf(window.llp),
      mode: 'preview',
      cssScale: true,
      onError: (message, error) => console.error(message, error),
    });
    open.add(this);
    followFonts();
  }

  draw(drawing: ThemeDrawing | null): void {
    this.view.draw(drawing);
  }

  refit(): void {
    this.view.refit();
  }

  dispose(): void {
    open.delete(this);
    this.view.dispose();
  }
}
