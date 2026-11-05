import {STARTER_TEXT_STYLE, STARTER_STAGE_ELEMENTS} from './starterLayout';
import {
  createScreenId,
  createThemeId,
  createThemeElementId,
} from '../schema/ids';
import type {Screen} from '../schema/screens';
import type {
  Theme,
  ThemeElement,
  ThemeScreenLayout,
  ThemesFile,
  ThemeText,
} from '../schema/themes';
import {STARTER_SCREEN_IDS} from '../screens/screens';
import {THEME_LIMITS, themeItemKinds, type ThemeItemKind} from './elementRules';

export type ThemeScreen = Pick<Screen, 'id' | 'kind' | 'method'>;

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const themeIds = {
  song: createThemeId(uuid(101)),
  bible: createThemeId(uuid(102)),
  notice: createThemeId(uuid(103)),
  media: createThemeId(uuid(104)),
};
const names = {song: '찬양', bible: '말씀', notice: '광고', media: '영상'};
const starterScreens: readonly ThemeScreen[] = [
  {
    id: createScreenId(STARTER_SCREEN_IDS.main),
    kind: 'audience',
    method: 'fullscreen',
  },
  {
    id: createScreenId(STARTER_SCREEN_IDS.broadcast),
    kind: 'broadcast',
    method: 'capture',
  },
  {
    id: createScreenId(STARTER_SCREEN_IDS.stage),
    kind: 'stage',
    method: 'fullscreen',
  },
];
const fullFrame = {x: 0, y: 0, w: THEME_LIMITS.width, h: THEME_LIMITS.height};
const {
  margin,
  maxLines,
  referencePosition: _referencePosition,
  ...basicText
} = STARTER_TEXT_STYLE;
export const DEFAULT_THEME_TEXT: ThemeText = basicText;
const inset = margin / 100;
const lyricFrame = {
  x: fullFrame.w * inset,
  y: fullFrame.h * inset,
  w: fullFrame.w * (1 - 2 * inset),
  h: fullFrame.h * (1 - 2 * inset),
};
const referenceHeight = 64;
const referenceGap = 24;
const audienceReferenceFrame = {
  ...lyricFrame,
  y: lyricFrame.y + lyricFrame.h - referenceHeight,
  h: referenceHeight,
};
const stageKinds = {
  currentLabel: 'label',
  currentSlide: 'currentText',
  clock: 'clock',
  timer: 'timer',
  nextLabel: 'nextLabel',
  nextSlide: 'nextText',
  stageMessage: 'stageMessage',
} as const;

function stageElements(): ThemeElement[] {
  const text: ThemeText = {
    ...basicText,
    shadow: {...basicText.shadow, on: false},
  };
  return STARTER_STAGE_ELEMENTS.map((element, index): ThemeElement => {
    const base = {
      id: createThemeElementId(uuid(index + 1)),
      frame: {...element.frame},
      text,
    };
    const kind = stageKinds[element.kind];
    if (kind === 'currentText' || kind === 'nextText') {
      return {...base, kind, text: {...text, maxLines}};
    }
    if (kind === 'clock') return {...base, kind, clockFormat: '24h'};
    return {...base, kind};
  });
}

/**
 * What a 무대 화면 shows with nothing live until its 대기 화면 is edited: the
 * clock and the timer, which draws only while a timer is set for the screen.
 */
export function standbyStageLayout(): ThemeScreenLayout {
  return {
    mode: {kind: 'own'},
    elements: stageElements().filter(
      element => element.kind === 'clock' || element.kind === 'timer',
    ),
  };
}

/**
 * The layout of a screen in the 대기 화면: the saved one, which may be empty,
 * or for a 무대 화면 with none saved (a file from before the 대기 화면 had
 * one) the built-in clock and timer. Output and the editor both read it here.
 */
export function standbyLayoutOf(
  standby: Theme,
  screen: Pick<Screen, 'id' | 'kind'>,
): ThemeScreenLayout | undefined {
  return (
    standby.screens[screen.id] ??
    (screen.kind === 'stage' ? standbyStageLayout() : undefined)
  );
}

function audienceElements(
  lowerThird: boolean,
  kind: ThemeItemKind,
): ThemeElement[] {
  const base = {frame: {...fullFrame}, fit: 'fit', radius: 0} as const;
  const textFrame = {
    ...lyricFrame,
    h: lyricFrame.h - (kind === 'bible' ? referenceHeight + referenceGap : 0),
  };
  const media: ThemeElement[] = lowerThird
    ? []
    : [
        {...base, id: createThemeElementId(uuid(1)), kind: 'background'},
        {...base, id: createThemeElementId(uuid(2)), kind: 'media'},
      ];
  return [
    ...media,
    {
      id: createThemeElementId(uuid(3)),
      kind: 'currentText',
      frame: textFrame,
      text: {...basicText, maxLines, vAlign: lowerThird ? 'bottom' : 'middle'},
    },
  ];
}

function layoutFor(
  screen: ThemeScreen,
  kind: ThemeItemKind,
): ThemeScreenLayout {
  const lowerThird = screen.kind === 'broadcast';
  const elements =
    screen.kind === 'stage'
      ? stageElements()
      : audienceElements(lowerThird, kind);
  if (kind === 'bible' && screen.kind !== 'stage') {
    elements.push({
      id: createThemeElementId(uuid(8)),
      kind: 'reference',
      frame: {...audienceReferenceFrame},
      text: {...basicText, size: 42, align: 'right', vAlign: 'bottom'},
    });
  }
  return {
    mode: {kind: 'own'},
    elements,
  };
}

/** Builds a fallback for the configured screens, including newly added screen IDs. */
export function builtInTheme(
  kind: ThemeItemKind,
  screens: readonly ThemeScreen[] = starterScreens,
): Theme {
  const fallbackKind =
    kind === 'blank' ? 'bible' : kind === 'ad' ? 'notice' : kind;
  return {
    id: themeIds[fallbackKind],
    name: names[fallbackKind],
    screens: Object.fromEntries(
      screens.map(screen => [screen.id, layoutFor(screen, kind)]),
    ),
  };
}

export function createDefaultThemes(
  screens: readonly ThemeScreen[] = starterScreens,
): ThemesFile {
  return {
    format: 'llsettings.themes',
    schemaVersion: 1,
    standby: {
      id: createThemeId(uuid(100)),
      name: '대기 화면',
      screens: Object.fromEntries(
        screens
          .filter(screen => screen.kind === 'stage')
          .map(screen => [screen.id, standbyStageLayout()]),
      ),
    },
    themes: themeItemKinds
      .filter(kind => kind !== 'blank' && kind !== 'ad')
      .map(kind => builtInTheme(kind, screens)),
    defaults: {...themeIds},
  };
}
