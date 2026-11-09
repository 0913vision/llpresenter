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
import {sundayScriptureLayout, sermonTitleLayout} from './sundayScripture';
import {sundayNoticeLayout} from './sundayNotice';
import {
  SECTION_THEMES,
  sundaySectionLayout,
  sectionOtherLayout,
} from './sundaySections';
import {
  sundayPreparationLayout,
  sundayServiceTimesLayout,
  PREPARATION_THEME_ID,
} from './sundayStandby';
import {creedPrayerTheme} from './creedPrayer';
import {SONG_THEME_ID} from './songTitle';
import {lightSongTheme} from './lightSong';

export type ThemeScreen = Pick<Screen, 'id' | 'kind' | 'method'>;

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const themeIds = {
  song: SONG_THEME_ID,
  bible: createThemeId(uuid(102)),
  media: createThemeId(uuid(104)),
  blank: createThemeId(uuid(102)),
  ad: createThemeId(uuid(105)),
};
const names = {
  song: '찬양',
  bible: '말씀',
  media: '영상',
  blank: '말씀',
  ad: '광고',
};
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
  const sundaySong = kind === 'song' && !lowerThird;
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
      frame: sundaySong ? {x: 132, y: 141, w: 1656, h: 411} : textFrame,
      text: sundaySong
        ? {
            ...basicText,
            maxLines,
            font: 'NanumSquare',
            weight: 800,
            size: 108,
            tracking: -3,
            lineHeight: 137 / 108,
            vAlign: 'top',
            shadow: {...basicText.shadow, on: false},
            outline: {...basicText.outline, on: false},
          }
        : {...basicText, maxLines, vAlign: lowerThird ? 'bottom' : 'middle'},
    },
  ];
}

function layoutFor(
  screen: ThemeScreen,
  kind: ThemeItemKind,
): ThemeScreenLayout {
  if (kind === 'bible' && screen.kind === 'audience') {
    return sundayScriptureLayout();
  }
  if (kind === 'ad') {
    return screen.kind === 'audience'
      ? sundayNoticeLayout()
      : advertisementLayout();
  }
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
    ...(kind === 'song' && screen.kind === 'audience'
      ? {songTitle: 'sunday' as const}
      : {}),
  };
}

/** The former unmodified section layout, used only when resolving saved defaults. */
export function legacySectionLayout(screen: ThemeScreen): ThemeScreenLayout {
  return layoutFor(screen, 'blank');
}

function advertisementLayout(): ThemeScreenLayout {
  const text: ThemeText = {
    ...basicText,
    align: 'left',
    vAlign: 'top',
    weight: 400,
    outline: {...basicText.outline, on: false},
    shadow: {...basicText.shadow, on: false},
  };
  const gold = '#e6b54a';
  return {
    mode: {kind: 'own'},
    elements: [
      {
        id: createThemeElementId(uuid(1)),
        kind: 'box',
        frame: {...fullFrame},
        box: {on: true, fill: '#141c2e', opacity: 100, radius: 0},
      },
      {
        id: createThemeElementId(uuid(2)),
        kind: 'box',
        frame: {...fullFrame, w: 24},
        box: {on: true, fill: gold, opacity: 100, radius: 0},
      },
      {
        id: createThemeElementId(uuid(3)),
        kind: 'text',
        frame: {x: 150, y: 190, w: 1600, h: 60},
        text: {...text, size: 42, weight: 600, color: gold},
        content: '교회 소식',
      },
      {
        id: createThemeElementId(uuid(4)),
        kind: 'media',
        frame: {...fullFrame},
        fit: 'fill',
        radius: 0,
      },
      {
        id: createThemeElementId(uuid(5)),
        kind: 'slideName',
        frame: {x: 150, y: 280.3, w: 1600, h: 151.8},
        text: {...text, size: 132, weight: 800, lineHeight: 1.15},
      },
      {
        id: createThemeElementId(uuid(6)),
        kind: 'currentText',
        frame: {x: 150, y: 504.1, w: 1600, h: 500},
        text: {
          ...text,
          size: 60,
          lineHeight: 1.55,
          color: '#c9d1e0',
          maxLines: 6,
        },
      },
    ],
  };
}

/** Builds a fallback for the configured screens, including newly added screen IDs. */
export function builtInTheme(
  kind: ThemeItemKind,
  screens: readonly ThemeScreen[] = starterScreens,
): Theme {
  const fallbackKind = kind === 'blank' ? 'bible' : kind;
  return {
    id: themeIds[fallbackKind],
    name: names[fallbackKind],
    screens: Object.fromEntries(
      screens.map(screen => [screen.id, layoutFor(screen, fallbackKind)]),
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
          .filter(screen => screen.kind !== 'broadcast')
          .map(screen => [
            screen.id,
            screen.kind === 'audience'
              ? sundayServiceTimesLayout()
              : standbyStageLayout(),
          ]),
      ),
    },
    themes: [
      ...themeItemKinds
        .filter(kind => kind !== 'blank' && kind !== 'ad')
        .map(kind => builtInTheme(kind, screens)),
      builtInTheme('ad', screens),
      lightSongTheme(builtInTheme('song', screens), screens),
      creedPrayerTheme(builtInTheme('bible', screens), screens),
      ...[false, true].map((twoLines, index): Theme => ({
        id: createThemeId(uuid(106 + index)),
        name: twoLines ? '설교 제목 (두 줄)' : '설교 제목',
        screens: Object.fromEntries(
          screens.map(screen => [
            screen.id,
            screen.kind === 'audience'
              ? sermonTitleLayout(twoLines)
              : layoutFor(screen, 'bible'),
          ]),
        ),
      })),
      ...SECTION_THEMES.map(({id, color}) => ({
        id,
        name: `구역 이름 ${color}`,
        screens: Object.fromEntries(
          screens.map(screen => [
            screen.id,
            screen.kind === 'audience'
              ? sundaySectionLayout(color)
              : sectionOtherLayout(layoutFor(screen, 'blank'), screen.kind),
          ]),
        ),
      })),
      {
        id: PREPARATION_THEME_ID,
        name: '예배 준비',
        screens: Object.fromEntries(
          screens.map(screen => [
            screen.id,
            screen.kind === 'audience'
              ? sundayPreparationLayout()
              : layoutFor(screen, 'blank'),
          ]),
        ),
      },
    ],
    defaults: {...themeIds},
  };
}
