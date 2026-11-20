import type {SlideLayer} from '@core/live/state';
import {createScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {isReferencedTextSlide} from '@core/themes/content';
import {BIBLE_THEME_ID, builtInTheme} from '@core/themes/defaults';
import type {ThemeFrame} from './layer';

const stage =
  builtInTheme('bible').screens[createScreenId(STARTER_SCREEN_IDS.stage)];
const current = stage?.elements.find(element => element.kind === 'currentText');
const next = stage?.elements.find(element => element.kind === 'nextText');

/** Uses the Bible stage text boxes for a referenced copy in another theme. */
export function stageScriptureLayout(
  theme: ThemeFrame,
  slide: SlideLayer | null,
) {
  const {layout, item} = theme;
  if (
    theme.themeId === BIBLE_THEME_ID ||
    layout.mode.kind !== 'own' ||
    !isReferencedTextSlide(slide, item?.kind)
  ) {
    return layout;
  }
  return {
    ...layout,
    elements: layout.elements.map(element => {
      if (element.kind === 'currentText' && current !== undefined) {
        return {...element, frame: current.frame, text: current.text};
      }
      if (element.kind === 'nextText' && next !== undefined) {
        const {lineLimit: _lineLimit, ...box} = element;
        return {
          ...box,
          frame: next.frame,
          text: next.text,
          ...(next.lineLimit === undefined ? {} : {lineLimit: next.lineLimit}),
        };
      }
      return element;
    }),
  };
}
