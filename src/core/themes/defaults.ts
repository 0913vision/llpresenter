import {
  STARTER_LYRIC_STYLE,
  STARTER_STAGE_ELEMENTS,
} from '../looks/starterLayout';
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
    kind: 'audience',
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
} = STARTER_LYRIC_STYLE;
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
  const lowerThird = screen.kind === 'audience' && screen.method === 'capture';
  const elements =
    screen.kind === 'stage'
      ? stageElements()
      : audienceElements(lowerThird, kind);
  if (kind === 'bible') {
    elements.push({
      id: createThemeElementId(uuid(8)),
      kind: 'reference',
      frame:
        screen.kind === 'stage'
          ? {x: 45, y: 384, w: 1194, h: referenceHeight}
          : {...audienceReferenceFrame},
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
  return {
    id: themeIds[kind],
    name: names[kind],
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
    standby: {id: createThemeId(uuid(100)), name: '대기 화면', screens: {}},
    themes: themeItemKinds.map(kind => builtInTheme(kind, screens)),
    defaults: {...themeIds},
  };
}
