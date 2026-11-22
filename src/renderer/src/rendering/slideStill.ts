import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import type {LiveLayers} from '@core/live/state';
import type {
  RenderFrame,
  RenderLayerOptions,
  RenderScreen,
  ThemeFrame,
} from './layer';
import {previewMediaOf} from './previewMedia';
import {ThemeCompositionView} from './themeComposition';

/** The screen and theme a still is drawn with. */
export interface StillAppearance extends Pick<
  RenderFrame,
  'audience' | 'stageLyricLabelPosition'
> {
  readonly screen: RenderScreen;
  readonly theme: ThemeFrame;
  readonly background: string;
}

/** What a still shows: the layers of one slide on one screen. */
export interface StillPicture {
  readonly layers: LiveLayers;
  readonly appearance: StillAppearance;
}

export type StillOptions = Pick<RenderLayerOptions, 'biblePreview'>;

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

/**
 * One slide drawn in place, by the same composition the output draws. Nothing
 * is kept between slides, so a still always shows the slide it was given.
 */
export class SlideStill {
  private readonly composition: ThemeCompositionView;
  private shown: StillPicture | null = null;

  constructor(host: HTMLElement, options: StillOptions = {}) {
    this.composition = new ThemeCompositionView(host, {
      ...options,
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl,
      previewMedia: previewMediaOf(window.llp),
      mode: 'preview',
      cssScale: true,
      onError: (message, error) => console.error(message, error),
    });
    open.add(this);
    followFonts();
  }

  draw(picture: StillPicture): void {
    this.shown = picture;
    const {layers, appearance} = picture;
    const {slide} = layers;
    this.composition.render(layers, {
      screen: appearance.screen,
      theme: appearance.theme,
      audience: appearance.audience,
      ...(appearance.stageLyricLabelPosition === undefined
        ? {}
        : {stageLyricLabelPosition: appearance.stageLyricLabelPosition}),
      transitions: false,
      still: true,
      ...(slide === null ? {} : {slide}),
    });
  }

  refit(): void {
    this.composition.refit();
    if (this.shown !== null) this.draw(this.shown);
  }

  dispose(): void {
    open.delete(this);
    this.composition.dispose();
  }
}
