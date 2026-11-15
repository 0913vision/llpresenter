import {builtInTheme, IMAGE_SLIDES_THEME_ID} from '@core/themes/defaults';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {
  createScreenId,
  createThemeElementId,
  type ThemeId,
} from '@core/schema/ids';
import type {ThemeScreenLayout} from '@core/schema/themes';

/** Temporary capture-only stage concepts; the variable is absent in normal builds. */
export function stageClockDraft(
  layout: ThemeScreenLayout,
  themeId: ThemeId,
  variant: string | undefined,
): ThemeScreenLayout {
  if (variant !== 'A' && variant !== 'B' && variant !== 'B2') return layout;
  let elements = [...layout.elements];
  if (
    themeId === IMAGE_SLIDES_THEME_ID &&
    !elements.some(element => element.kind === 'timer')
  ) {
    const stageId = createScreenId(STARTER_SCREEN_IDS.stage);
    const timer = builtInTheme('song').screens[stageId]?.elements.find(
      element => element.kind === 'timer',
    );
    if (timer !== undefined) elements.push(timer);
  }
  if (variant === 'A') {
    elements = elements.map(element =>
      element.kind === 'clock' || element.kind === 'timer'
        ? {
            ...element,
            text: {
              ...element.text,
              outline: {on: true, width: 3, color: '#000000'},
              shadow: {
                on: true,
                blur: 8,
                distance: 2,
                angle: 45,
                opacity: 60,
                color: '#000000',
              },
            },
          }
        : element,
    );
  } else {
    const stripHeight = variant === 'B2' ? 64 : 100;
    elements = elements.map(element =>
      element.kind === 'media' && themeId === IMAGE_SLIDES_THEME_ID
        ? {
            ...element,
            frame: {x: 0, y: stripHeight, w: 1920, h: 1080 - stripHeight},
            fit: 'fit' as const,
          }
        : variant === 'B2' &&
            (element.kind === 'clock' || element.kind === 'timer')
          ? {
              ...element,
              frame: {...element.frame, y: 4, h: 56},
              text: {
                ...element.text,
                size: element.kind === 'clock' ? 44 : 36,
              },
            }
          : element,
    );
    const backgroundEnd = elements.reduce(
      (last, element, index) =>
        ['media', 'background', 'image'].includes(element.kind) ? index : last,
      -1,
    );
    elements.splice(backgroundEnd + 1, 0, {
      id: createThemeElementId('59900000-0000-4000-8000-000000000001'),
      kind: 'box',
      frame: {x: 0, y: 0, w: 1920, h: stripHeight},
      box: {on: true, fill: '#000000', opacity: 100, radius: 0},
    });
  }
  return {...layout, elements};
}
