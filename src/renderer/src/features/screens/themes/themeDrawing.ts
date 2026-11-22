import {createScreenId} from '@core/schema/ids';
import type {Screen} from '@core/schema/screens';
import {
  type OwnThemeScreen,
  type ThemeFile,
  THEME_CANVAS,
} from '@core/schema/theme';
import {nextPhraseOf} from '@core/theme/content';
import {sampleContent} from '@core/theme/samples';
import {
  pictureScreen,
  type SlideDrawing,
} from '@renderer/pictures/slideDrawing';
import {themeOn} from '@renderer/rendering/theme/drawing';
import type {LabelPlace} from '@renderer/rendering/theme/themeView';

// NOTE(0913vision): No output has this id, so the picture keeps its own size.
const CANVAS_ID = createScreenId('00000000-0000-4000-8000-000000000000');

/**
 * How a theme looks on a screen, with words of the editor in its boxes. Its
 * picture is the whole canvas of the theme, whatever shape the screen has.
 */
export function sampleDrawing(
  theme: ThemeFile,
  screen: Screen,
  {
    screens,
    labels,
    layout,
  }: {
    readonly screens: readonly Screen[];
    readonly labels: LabelPlace;
    /** A layout that is being changed, instead of the one of the theme. */
    readonly layout?: OwnThemeScreen | undefined;
  },
): SlideDrawing {
  const shown = pictureScreen(screens, {
    role: screen.kind,
    screenId: screen.id,
  });
  const canvas = {...shown, id: CANVAS_ID, pictureSize: THEME_CANVAS};
  const on = themeOn(theme, shown);
  if (on === null) return {drawing: null, screen: canvas};
  const content = sampleContent(theme);
  return {
    screen: canvas,
    drawing: {
      ...on,
      screen: layout ?? on.screen,
      content,
      next: nextPhraseOf(theme, content, false),
      background: theme.background,
      labels,
      opaque: false,
      emptyColor: shown.emptyColor ?? '#000000',
    },
  };
}
