import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {rendererErrorEntry} from '@core/schema/app/ipcPayloads';
import {previewMediaOf} from './media/previewMedia';
import {ThemeView} from './theme/themeView';
import {type ThemeDrawing} from './theme/shownTexts';

const open = new Set<SlideStill>();
let following = false;
/** The still failures already written, by what failed. */
const reported = new Set<string>();
const REPORTED_KEPT = 200;

/**
 * Writes a failure of a slide still to the app log once, as a warning: the
 * still shows it in place, and a file missing on many thumbnails is one line.
 */
export function reportStillFailure(message: string, error: unknown): void {
  const entry = {...rendererErrorEntry(message, error), level: 'warn' as const};
  const key = `${entry.message}|${entry.detail ?? ''}`;
  if (reported.has(key)) return;
  if (reported.size >= REPORTED_KEPT) reported.clear();
  reported.add(key);
  window.llp?.log.write(entry);
}

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
      onError: reportStillFailure,
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
