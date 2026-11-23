import type {LiveLayers, SlideLayer} from '@core/schema/live';
import type {LiveThemeOutput} from '@core/schema/liveTheme';
import {isKeyBackground} from '@core/screens';
import type {SlideContent} from '@core/schema/slideContent';
import {themeScreenOf} from '@core/theme';
import type {RenderFrame, RenderScreen} from '../layer';
import type {ThemeDrawing} from './themeView';

/** What a live slide says. */
export function layerContent(slide: SlideLayer): SlideContent {
  return {
    texts: slide.texts,
    auto: slide.auto,
    ...(slide.continued === undefined ? {} : {continued: true}),
  };
}

/** The theme of a slide on one screen. */
export function themeOn(
  theme: LiveThemeOutput['theme'],
  screen: Pick<RenderScreen, 'id' | 'kind'>,
): Pick<ThemeDrawing, 'theme' | 'screen'> | null {
  const own = themeScreenOf(theme, screen);
  return own === null ? null : {theme, screen: own};
}

/** What a screen draws of the live slide; null when its theme has nothing. */
export function liveDrawing(
  layers: LiveLayers,
  frame: RenderFrame,
  transparent: boolean,
): ThemeDrawing | null {
  const {theme: output, screen} = frame;
  if (output === undefined || screen === undefined) return null;
  const on = themeOn(output.theme, screen);
  if (on === null) return null;
  const {slide, media} = layers;
  // NOTE(0913vision): With nothing live there is nothing to clear, so 대기 화면
  // has its own background.
  const standby = frame.item === null && slide === null && media === null;
  const emptyColor = screen.emptyColor ?? '#000000';
  return {
    ...on,
    content: slide === null ? null : layerContent(slide),
    next: slide?.next ?? null,
    background: output.background,
    ...(standby ? {} : {media}),
    ...(slide?.peers === undefined ? {} : {peers: slide.peers}),
    ...(frame.stageLyricLabelPosition === undefined
      ? {}
      : {labels: frame.stageLyricLabelPosition}),
    opaque:
      !transparent && isKeyBackground(on.screen.backdrop ?? emptyColor, screen),
    emptyColor,
    ...(frame.standby === undefined ? {} : {standby: frame.standby}),
  };
}
