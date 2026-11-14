import {STARTER_TEXT_STYLE, STARTER_STAGE_ELEMENTS} from './starterLayout';
import {STAGE_COLORS} from './stageColors';
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
import {
  sundayScriptureLayout,
  sermonTitleLayout,
  SERMON_TITLE_THEME_ID,
} from './sundayScripture';
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
import {broadcastBandLayout} from './broadcastBand';
import {broadcastLookLayout} from './broadcastLook';
import {sectionBroadcastLayout} from './sectionBroadcast';

export type ThemeScreen = Pick<Screen, 'id' | 'kind' | 'method'>;

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
export const IMAGE_SLIDES_THEME_ID = createThemeId(uuid(107));
export const AD_THEME_ID = createThemeId(uuid(105));
const themeIds = {
  song: SONG_THEME_ID,
  bible: createThemeId(uuid(102)),
  media: createThemeId(uuid(104)),
  blank: createThemeId(uuid(102)),
  ad: AD_THEME_ID,
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
export function imageSlidesLayout(kind: Screen['kind']): ThemeScreenLayout {
  if (kind === 'broadcast') return {mode: {kind: 'own'}, elements: []};
  return {
    mode: {kind: 'own'},
    background: '#000000',
    elements: [
      {
        id: createThemeElementId(uuid(2)),
        kind: 'media',
        frame: fullFrame,
        fit: 'fit',
        radius: 0,
      },
      ...(kind === 'stage'
        ? stageElements().filter(element => element.kind === 'clock')
        : []),
    ],
  };
}
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
function stageElements(kind: ThemeItemKind = 'song'): ThemeElement[] {
  const text: ThemeText = {
    ...basicText,
    shadow: {...basicText.shadow, on: false},
  };
  const contentFont = kind === 'ad' ? 'KoPubWorldDotum' : 'NanumSquare';
  const contentWeight = kind === 'ad' ? 500 : kind === 'bible' ? 700 : 800;
  const ids = {
    currentLabel: 2,
    stageMessage: 3,
    timer: 5,
    clock: 6,
    currentSlide: 7,
    nextSlide: 8,
  };
  const elements = STARTER_STAGE_ELEMENTS.map((element): ThemeElement => {
    const base = {
      id: createThemeElementId(uuid(ids[element.kind])),
      frame: {...element.frame},
    };
    switch (element.kind) {
      case 'currentLabel':
        return {
          ...base,
          kind: 'label',
          hideWhenItemTitle: true,
          text: {...text, size: 40, lineHeight: 1.1, align: 'center'},
        };
      case 'clock':
        return {
          ...base,
          kind: 'clock',
          clockFormat: '24h',
          seconds: true,
          text: {
            ...text,
            size: 60,
            lineHeight: 1.1,
            align: 'right',
            color: STAGE_COLORS.clock,
          },
        };
      case 'timer':
        return {
          ...base,
          kind: 'timer',
          text: {...text, size: 42, align: 'right', color: STAGE_COLORS.next},
        };
      case 'stageMessage':
        return {
          ...base,
          kind: 'stageMessage',
          text: {
            ...text,
            size: 30,
            lineHeight: 1.1,
            align: 'center',
            color: STAGE_COLORS.next,
          },
        };
      case 'currentSlide':
        return {
          ...base,
          kind: 'currentText',
          text: {
            ...text,
            font: contentFont,
            weight: contentWeight,
            size: kind === 'bible' ? 104 : kind === 'ad' ? 86 : 108,
            ...(kind === 'ad'
              ? {font: 'KoPubWorldDotum', weight: 500, lineHeight: 128 / 86}
              : {}),
            ...(kind === 'ad' ? {} : {lineHeight: 1.2}),
            maxLines: 4,
            ...(kind === 'bible' || kind === 'ad'
              ? {align: 'left' as const, vAlign: 'top' as const}
              : {}),
          },
          ...(kind === 'bible' || kind === 'ad'
            ? {
                frame: {
                  ...base.frame,
                  y: kind === 'ad' ? 240 : 230,
                  h: kind === 'ad' ? 458 : 468,
                },
              }
            : {}),
        };
      case 'nextSlide':
        return {
          ...base,
          kind: 'nextText',
          lineLimit: 2,
          text: {
            ...text,
            font: contentFont,
            size: 80,
            lineHeight: 1.2,
            maxLines: 2,
            vAlign: 'bottom',
            color: STAGE_COLORS.next,
            ...(kind === 'bible' ? {align: 'left' as const} : {}),
          },
        };
    }
  });
  if (kind === 'bible') {
    elements.push({
      id: createThemeElementId(uuid(9)),
      kind: 'reference',
      source: 'item',
      frame: {x: 154, y: 130, w: 1612, h: 90},
      text: {
        ...text,
        size: 48,
        align: 'left',
        vAlign: 'middle',
        lineHeight: 1.1,
      },
    });
  } else if (kind === 'ad') {
    elements.push({
      id: createThemeElementId(uuid(9)),
      kind: 'slideName',
      frame: {x: 154, y: 110, w: 1612, h: 120},
      text: {
        ...text,
        font: 'KoPubWorldDotum',
        weight: 700,
        color: STAGE_COLORS.next,
        size: 108,
        align: 'left',
        vAlign: 'middle',
        lineHeight: 1.1,
      },
    });
  }
  return kind === 'bible'
    ? elements.filter(element => element.kind !== 'label')
    : elements;
}

/**
 * What a 무대 화면 shows with nothing live until its 대기 화면 is edited: the
 * clock and the timer, which draws only while a timer is set for the screen.
 */
export function standbyStageLayout(): ThemeScreenLayout {
  const elements = stageElements();
  const clock = elements.find(element => element.kind === 'clock');
  const timer = elements.find(element => element.kind === 'timer');
  if (clock === undefined || timer === undefined) {
    throw Error('Missing stage clock or timer');
  }
  return {mode: {kind: 'own'}, elements: [clock, timer]};
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

function preparationStageLayout(screen: ThemeScreen): ThemeScreenLayout {
  const layout = layoutFor(screen, 'blank');
  const fallbackText = sundayPreparationLayout()
    .elements.flatMap(element =>
      element.kind === 'text' ? [element.content] : [],
    )
    .join('\n');
  return {
    ...layout,
    elements: layout.elements.map(element =>
      element.kind === 'currentText' ? {...element, fallbackText} : element,
    ),
  };
}

function audienceElements(
  lowerThird: boolean,
  kind: ThemeItemKind,
): ThemeElement[] {
  const base = {frame: {...fullFrame}, fit: 'fill', radius: 0} as const;
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
      frame: sundaySong ? {x: 14, y: 141, w: 1892, h: 411} : textFrame,
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
  if (screen.kind === 'broadcast') {
    if (kind === 'ad') {
      return {mode: {kind: 'own'}, elements: []};
    }
    if (kind === 'media') return broadcastBandLayout(kind, basicText);
    return broadcastLookLayout(kind === 'song' ? 'song' : 'plain');
  }
  if (kind === 'bible' && screen.kind === 'audience') {
    return sundayScriptureLayout();
  }
  if (kind === 'ad' && screen.kind === 'audience') {
    return sundayNoticeLayout();
  }
  const elements =
    screen.kind === 'stage'
      ? stageElements(kind)
      : audienceElements(false, kind);
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
    ...(screen.kind === 'stage'
      ? {
          stageBar: 'message-row' as const,
          background: '#000000',
        }
      : {}),
    ...(kind === 'song' && screen.kind === 'audience'
      ? {songTitle: 'sunday' as const}
      : {}),
  };
}

/** The former unmodified section layout, used only when resolving saved defaults. */
export function legacySectionLayout(screen: ThemeScreen): ThemeScreenLayout {
  if (screen.kind === 'broadcast') {
    return {mode: {kind: 'own'}, elements: audienceElements(true, 'blank')};
  }
  const layout = layoutFor(screen, 'blank');
  return screen.kind !== 'stage'
    ? layout
    : {
        ...layout,
        elements: layout.elements.map(element =>
          element.kind === 'currentText'
            ? {...element, text: {...element.text, size: 170}}
            : element.kind === 'clock'
              ? {...element, frame: {x: 1460, y: 982, w: 400, h: 80}}
              : element.kind === 'timer'
                ? {...element, frame: {x: 1640, y: 20, w: 220, h: 65}}
                : element.kind === 'stageMessage'
                  ? {...element, frame: {x: 770, y: 53, w: 490, h: 42}}
                  : element,
        ),
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
      {
        id: IMAGE_SLIDES_THEME_ID,
        name: '이미지 슬라이드',
        screens: Object.fromEntries(
          screens.map(screen => [screen.id, imageSlidesLayout(screen.kind)]),
        ),
      },
      {
        id: SERMON_TITLE_THEME_ID,
        name: '설교 제목',
        screens: Object.fromEntries(
          screens.map(screen => [
            screen.id,
            screen.kind === 'audience'
              ? sermonTitleLayout()
              : layoutFor(screen, 'bible'),
          ]),
        ),
      },
      ...SECTION_THEMES.map(({id, color}) => ({
        id,
        name: `구역 이름 ${color}`,
        screens: Object.fromEntries(
          screens.map(screen => [
            screen.id,
            screen.kind === 'audience'
              ? sundaySectionLayout(color)
              : screen.kind === 'broadcast'
                ? sectionBroadcastLayout()
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
              : screen.kind === 'stage'
                ? preparationStageLayout(screen)
                : layoutFor(screen, 'blank'),
          ]),
        ),
      },
    ],
    defaults: {...themeIds},
  };
}
