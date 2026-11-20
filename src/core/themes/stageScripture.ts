import type {SlideLayer} from '../live/state';
import {createScreenId, type ThemeId} from '../schema/ids';
import type {LiveThemeItem} from '../schema/liveTheme';
import type {ThemeScreenLayout} from '../schema/themes';
import {STARTER_SCREEN_IDS} from '../screens/screens';
import {isReferencedTextSlide} from './content';
import {BIBLE_THEME_ID, builtInTheme} from './defaults';

const bibleNext = builtInTheme('bible').screens[
  createScreenId(STARTER_SCREEN_IDS.stage)
]?.elements.find(element => element.kind === 'nextText');

/** Gives a referenced copy the Bible next text box when the stage uses another theme. */
export function stageScriptureNextLayout(
  theme: {
    readonly themeId: ThemeId;
    readonly layout: ThemeScreenLayout;
    readonly item: LiveThemeItem | null;
  },
  slide: SlideLayer | null,
): ThemeScreenLayout {
  const {layout, item} = theme;
  if (
    theme.themeId === BIBLE_THEME_ID ||
    layout.mode.kind !== 'own' ||
    bibleNext === undefined ||
    slide?.next?.biblePart === undefined ||
    !isReferencedTextSlide(slide, item?.kind)
  ) {
    return layout;
  }
  const {frame, text, lineLimit} = bibleNext;
  return {
    ...layout,
    elements: layout.elements.map(element => {
      if (element.kind !== 'nextText') return element;
      const {lineLimit: _lineLimit, ...box} = element;
      return {
        ...box,
        frame,
        text,
        ...(lineLimit === undefined ? {} : {lineLimit}),
      };
    }),
  };
}
