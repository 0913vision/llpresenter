import type {LiveLayers, SlideLayer} from '@core/schema/live/live';
import type {LiveThemeOutput} from '@core/schema/live/liveTheme';
import {isKeyBackground} from '@core/screens';
import type {SlideContent} from '@core/schema/slides/slideContent';
import {themeScreenOf} from '@core/theme';
import type {RenderFrame, RenderScreen} from '../layer';
import type {ThemeDrawing} from './shownTexts';

/** What a live slide says. */
export function layerContent(slide: SlideLayer): SlideContent {
  return {
    texts: slide.texts,
    auto: slide.auto,
    ...(slide.continued === undefined ? {} : {continued: true}),
  };
}

/** The theme of a slide on one screen. */
function themeOn(
  theme: LiveThemeOutput['theme'],
  screen: Pick<RenderScreen, 'id' | 'kind'>,
): Pick<ThemeDrawing, 'theme' | 'screen'> | null {
  const own = themeScreenOf(theme, screen);
  return own === null ? null : {theme, screen: own};
}

/** What a slide gives a screen to draw, apart from the theme and the screen. */
export type SlideOnScreen = Pick<
  ThemeDrawing,
  'content' | 'next' | 'background' | 'media' | 'peers' | 'standby'
>;

/**
 * What one screen draws of one slide; null when the theme has nothing for that
 * screen. Outputs, previews, thumbnails and the theme editor all make their
 * drawing here. Only an output that can't show transparent color is opaque.
 */
export function drawingOn(
  {
    theme,
    screen,
    transparent = true,
  }: {
    readonly theme: LiveThemeOutput['theme'];
    readonly screen: RenderScreen;
    readonly transparent?: boolean | undefined;
  },
  slide: SlideOnScreen,
): ThemeDrawing | null {
  const on = themeOn(theme, screen);
  if (on === null) return null;
  const emptyColor = screen.emptyColor ?? '#000000';
  return {
    ...on,
    ...slide,
    opaque:
      !transparent && isKeyBackground(on.screen.backdrop ?? emptyColor, screen),
    emptyColor,
  };
}

/** What a screen draws of the live slide; null when its theme has nothing. */
export function liveDrawing(
  layers: LiveLayers,
  frame: RenderFrame,
  transparent: boolean,
): ThemeDrawing | null {
  const {theme: output, screen} = frame;
  if (output === undefined || screen === undefined) return null;
  const {slide, media} = layers;
  // NOTE(0913vision): With nothing live there is nothing to clear, so 대기 화면
  // has its own background.
  const standby = frame.item === null && slide === null && media === null;
  return drawingOn(
    {theme: output.theme, screen, transparent},
    {
      content: slide === null ? null : layerContent(slide),
      next: slide?.next ?? null,
      background: output.background,
      ...(standby ? {} : {media}),
      ...(slide?.peers === undefined ? {} : {peers: slide.peers}),
      ...(frame.standby === undefined ? {} : {standby: frame.standby}),
    },
  );
}
