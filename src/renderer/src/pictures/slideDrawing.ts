import {emptyScreenColor} from '@core/screens/emptyColor';
import {pictureSizeForScreen} from '@core/screens/pictureSize';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {createScreenId} from '@core/schema/ids';
import type {Screen} from '@core/schema/screens';
import type {ShowTile} from '@core/schema/showService';
import type {ThemeFile} from '@core/schema/theme';
import type {Themes} from '@core/schema/themes';
import {peersOf, tileContent} from '@core/presentation/slideLayer';
import {themeOfSlide} from '@core/theme/themes';
import type {ThemesView} from '@renderer/platform/themes';
import type {RenderScreen} from '@renderer/rendering/layer';
import {themeOn} from '@renderer/rendering/theme/drawing';
import type {ThemeDrawing} from '@renderer/rendering/theme/themeView';

type ScreenRole = Screen['kind'];

/** What a picture shows, and the screen whose shape it has. */
export interface SlideDrawing {
  readonly drawing: ThemeDrawing | null;
  readonly screen: RenderScreen;
}

const MAIN_SCREEN: Screen = {
  id: createScreenId(STARTER_SCREEN_IDS.main),
  name: '청중 화면',
  kind: 'audience',
  method: 'fullscreen',
};

/** The screen a picture is of: the one named, or the first of its role. */
export function pictureScreen(
  screens: readonly Screen[],
  {
    role = 'audience',
    screenId,
  }: {
    readonly role?: ScreenRole | undefined;
    readonly screenId?: string | undefined;
  } = {},
): RenderScreen {
  const screen =
    screens.find(entry => entry.id === screenId && entry.kind === role) ??
    screens.find(entry => entry.kind === role) ??
    (role === 'audience' ? MAIN_SCREEN : {...MAIN_SCREEN, kind: role});
  const pictureSize = pictureSizeForScreen(screen);
  return {
    id: screen.id,
    name: screen.name,
    kind: screen.kind,
    method: screen.method,
    emptyColor: emptyScreenColor(screen),
    ...(pictureSize === undefined ? {} : {pictureSize}),
  };
}

export interface TileDrawingOptions {
  readonly role?: ScreenRole | undefined;
  readonly screenId?: string | undefined;
  /** What the slide after this one shows on 무대. */
  readonly next?: string | null | undefined;
  /** The slides of the item, for texts that are sized together. */
  readonly tiles?: readonly ShowTile[] | undefined;
  /** Draws the slide with this theme instead of its own. */
  readonly theme?: ThemeFile | undefined;
}

/** What a screen draws of a slide, as a still. */
export function tileDrawing(
  tile: ShowTile,
  {
    themes,
    screens,
    labels,
  }: Pick<ThemesView, 'screens' | 'labels'> & {
    readonly themes: Themes | null;
  },
  options: TileDrawingOptions = {},
): SlideDrawing {
  const screen = pictureScreen(screens, options);
  const theme = options.theme ?? themeOfSlide(themes, tile.slide);
  const on = themeOn(theme, screen);
  if (on === null) return {drawing: null, screen};
  const peers =
    options.tiles === undefined ? undefined : peersOf(options.tiles, theme);
  return {
    screen,
    drawing: {
      ...on,
      content: tileContent(tile),
      next: options.next ?? null,
      background: tile.slide.background ?? theme.background,
      ...(peers === undefined ? {} : {peers}),
      labels,
      opaque: false,
      emptyColor: screen.emptyColor ?? '#000000',
    },
  };
}
