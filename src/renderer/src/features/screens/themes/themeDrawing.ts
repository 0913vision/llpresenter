import {createScreenId} from '@core/schema/common/ids';
import type {Screen} from '@core/schema/screens/screens';
import {
  type OwnThemeScreen,
  type ThemeFile,
  THEME_CANVAS,
} from '@core/schema/screens/theme';
import {nextPhraseOf, sampleContent} from '@core/theme';
import {
  pictureScreen,
  type SlideDrawing,
} from '@renderer/pictures/slideDrawing';
import {drawingOn} from '@renderer/rendering/theme/drawing';

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
    layout,
  }: {
    readonly screens: readonly Screen[];
    /** A layout that is being changed, instead of the one of the theme. */
    readonly layout?: OwnThemeScreen | undefined;
  },
): SlideDrawing {
  const shown = pictureScreen(screens, {
    role: screen.kind,
    screenId: screen.id,
  });
  const canvas = {...shown, id: CANVAS_ID, pictureSize: THEME_CANVAS};
  const content = sampleContent(theme);
  const drawing = drawingOn(
    {theme, screen: shown},
    {
      content,
      next: nextPhraseOf(theme, content),
      background: theme.background,
    },
  );
  return {
    screen: canvas,
    drawing:
      drawing === null || layout === undefined
        ? drawing
        : {...drawing, screen: layout},
  };
}
