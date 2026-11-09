import {
  createMediaId,
  createThemeElementId,
  createThemeId,
  type ThemeId,
} from '../schema/ids';
import type {
  ThemeElement,
  ThemeScreenLayout,
  ThemeText,
} from '../schema/themes';
import {GRADIENT_PRESETS} from './gradientPresets';

export const SECTION_THEME_ID = createThemeId(
  '00000000-0000-4000-8000-000000000111',
);
export const SECTION_RULES_ID = createMediaId(
  '00000000-0000-4000-8000-000000000407',
);

export const SECTION_THEMES = [
  {color: '청록', id: SECTION_THEME_ID},
  {color: '적갈', id: createThemeId('00000000-0000-4000-8000-000000000120')},
  {color: '초록', id: createThemeId('00000000-0000-4000-8000-000000000121')},
  {color: '자주', id: createThemeId('00000000-0000-4000-8000-000000000122')},
  {
    color: '청록초록',
    id: createThemeId('00000000-0000-4000-8000-000000000123'),
  },
  {color: '남보라', id: createThemeId('00000000-0000-4000-8000-000000000124')},
  {color: '올리브', id: createThemeId('00000000-0000-4000-8000-000000000125')},
] as const;

export function isSectionTheme(id: ThemeId | undefined): boolean {
  return SECTION_THEMES.some(section => section.id === id);
}

export type SectionColor = (typeof SECTION_THEMES)[number]['color'];

export interface SundaySection {
  readonly name: string;
  readonly english: string;
  readonly color: SectionColor;
  readonly theme: ThemeId;
}

/** The section-card insertion data, in the church's service order. */
export const SUNDAY_SECTIONS: readonly SundaySection[] = (
  [
    ['묵상기도', '', '청록'],
    ['사도신경', "Apostle's Creed", '청록'],
    ['회개와간구의기도', 'Repentance Prayer', '적갈'],
    ['찬양', 'Praise', '초록'],
    ['합심기도', 'Corporate Prayer', '적갈'],
    ['봉헌', 'Offering', '자주'],
    ['봉헌기도', 'Offering Prayer', '자주'],
    ['성찬식', 'Holy Communion', '청록초록'],
    ['축복기도', 'Blessing', '남보라'],
    ['세례식', 'Baptism', '청록초록'],
    ['간구기도', 'Supplication Prayer', '적갈'],
    ['광고', 'Notice', '남보라'],
    ['축도', 'Benediction', '올리브'],
  ] as const
).map(([name, english, color]) => ({
  name,
  english,
  color,
  theme: sectionTheme(color),
}));

function sectionTheme(color: SectionColor) {
  const theme = SECTION_THEMES.find(theme => theme.color === color);
  if (theme === undefined) throw Error('Missing section theme');
  return theme.id;
}

/** Uses the same approved palette as the gradient editor and output. */
export function sectionGradient(color: SectionColor) {
  const preset = GRADIENT_PRESETS.find(preset => preset.name === color);
  if (preset === undefined) throw Error('Missing section gradient preset');
  return preset.gradient;
}

const id = (number: number) =>
  createThemeElementId(
    `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  );
const frame = {x: 0, y: 0, w: 1920, h: 1080};
const text: ThemeText = {
  font: 'KoPubWorldDotum',
  weight: 700,
  size: 152,
  color: '#FFFFFF',
  align: 'center',
  vAlign: 'top',
  lineHeight: 1,
  tracking: 52,
  shortTracking: {
    maxCharacters: 2,
    tracking: 152,
    overrides: [
      {text: '회개와간구의기도', tracking: 40},
      {text: '봉헌', tracking: 52},
    ],
  },
  shadow: {
    on: false,
    color: '#000000',
    opacity: 0,
    angle: 45,
    blur: 0,
    distance: 0,
  },
  outline: {on: false, color: '#000000', width: 1},
};

export function sundaySectionLayout(
  color: SectionColor = '청록',
): ThemeScreenLayout {
  const {shortTracking: _shortTracking, ...english} = text;
  return {
    mode: {kind: 'own'},
    background: sectionGradient(color),
    elements: [
      {id: id(1), kind: 'background', frame, fit: 'stretch', radius: 0},
      {id: id(2), kind: 'media', frame, fit: 'fill', radius: 0},
      {
        id: id(3),
        kind: 'image',
        frame,
        mediaId: SECTION_RULES_ID,
        fit: 'stretch',
        radius: 0,
      },
      {
        id: id(4),
        kind: 'itemName',
        frame: {x: 44, y: 412, w: 1876, h: 240},
        centerWhenTextEmpty: true,
        text,
      },
      {
        id: id(5),
        kind: 'currentText',
        frame: {x: 40, y: 613, w: 1880, h: 90},
        text: {...english, weight: 300, size: 56, tracking: 34, maxLines: 1},
      },
    ],
  };
}

/** Section cards keep the normal broadcast and stage controls around their title. */
export function sectionOtherLayout(
  layout: ThemeScreenLayout,
  kind: 'broadcast' | 'stage',
): ThemeScreenLayout {
  if (layout.mode.kind !== 'own') return layout;
  return {
    ...layout,
    elements: layout.elements.flatMap<ThemeElement>(element => {
      if (element.kind !== 'currentText') return [element];
      if (kind === 'broadcast') {
        return [{...element, kind: 'itemName' as const}];
      }
      return [
        {
          ...element,
          kind: 'itemName' as const,
          frame: {...element.frame, h: 150},
        },
        {
          ...element,
          id: id(99),
          frame: {...element.frame, y: element.frame.y + 150, h: 90},
          text: {...element.text, size: 42, maxLines: 1},
        },
      ];
    }),
  };
}
