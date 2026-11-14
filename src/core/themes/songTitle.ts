import type {SongLyricFormat} from '../schema/songLyricFormat';
import {DEFAULT_SONG_TITLE_LAYOUT} from '../schema/songTitleLayout';
import type {SlideLayer} from '../live/state';
import {createThemeElementId, createThemeId} from '../schema/ids';
import type {
  ThemeElement,
  ThemeScreenLayout,
  ThemeText,
} from '../schema/themes';
import {STARTER_TEXT_STYLE} from './starterLayout';

export const SONG_THEME_ID = createThemeId(
  '00000000-0000-4000-8000-000000000101',
);

const titleText: ThemeText = {
  ...STARTER_TEXT_STYLE,
  font: 'NanumSquare',
  weight: 800,
  size: 120,
  tracking: 0,
  lineHeight: 1.2,
  align: 'center',
  vAlign: 'top',
  color: '#FFFFFF',
  shadow: {...STARTER_TEXT_STYLE.shadow, on: false},
  outline: {...STARTER_TEXT_STYLE.outline, on: false},
};

/** Runtime composition metadata, separate from the saved theme schema. */
export type ResolvedThemeElement = ThemeElement & {
  readonly clearTarget?: 'slide';
  readonly runtimeHidden?: boolean;
  readonly minimumTextSize?: number;
  readonly broadcastGlass?: 'panel' | 'header';
  readonly broadcastSong?: 'band' | 'bandText' | 'text';
  readonly broadcastBibleFlow?: boolean;
  readonly broadcastText?: string;
  readonly broadcastSongTitle?: string;
  readonly broadcastSongTitleWrap?: boolean;
  readonly lyricFormat?: SongLyricFormat;
};

/** Resolves the Sunday title in the same composition for output and thumbnails. */
export function songTitleLayout(
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
): ThemeScreenLayout {
  if (
    layout.mode.kind !== 'own' ||
    layout.songTitle === undefined ||
    !slide?.titleSlide
  ) {
    return layout;
  }
  const lyrics = layout.elements.find(
    element => element.kind === 'currentText',
  );
  const imported = slide.lyricFormat;
  if (
    imported?.lines.length === slide.lines.length &&
    imported.lines.every(
      (line, index) =>
        line.runs.map(run => run.text).join('') === slide.lines[index],
    )
  ) {
    const color =
      lyrics?.kind === 'currentText' ? lyrics.text.color : titleText.color;
    const formatted: ResolvedThemeElement[] = imported.lines.map(
      (line, index) => {
        const firstRun = line.runs[0];
        const size = firstRun?.size ?? titleText.size;
        const {paragraphGap: _paragraphGap, ...positionedLine} = line;
        return {
          id: createThemeElementId(
            `00000000-0000-4001-8000-${String(index + 1).padStart(12, '0')}`,
          ),
          kind: 'text',
          clearTarget: 'slide',
          content: slide.lines[index] ?? '',
          frame: {
            x: line.left ?? 0,
            y: line.top ?? (index === 0 ? 181 : 345),
            w: line.boxWidth,
            h: Math.min(
              1080 - (line.top ?? (index === 0 ? 181 : 345)),
              Math.max(90, size * 1.5),
            ),
          },
          text: {
            ...titleText,
            color,
            size,
            font: firstRun?.font ?? titleText.font,
            weight: firstRun?.weight ?? titleText.weight,
          },
          lyricFormat: {lines: [positionedLine]},
        };
      },
    );
    return {
      ...layout,
      elements: layout.elements.flatMap(element =>
        element.kind === 'currentText' ? formatted : [element],
      ),
    };
  }
  const spacing = {...DEFAULT_SONG_TITLE_LAYOUT, ...slide.titleLayout};
  const text = {
    ...titleText,
    color: lyrics?.kind === 'currentText' ? lyrics.text.color : titleText.color,
    tracking: spacing.titleTracking,
  };
  const title: ResolvedThemeElement = {
    id: createThemeElementId('00000000-0000-4000-8000-000000000383'),
    kind: 'text',
    clearTarget: 'slide',
    content: slide.lines[0] ?? '',
    frame: {x: 339, y: spacing.titleTop, w: 1242, h: 160},
    text,
  };
  const subtitle: ResolvedThemeElement = {
    id: createThemeElementId('00000000-0000-4000-8000-000000000384'),
    kind: 'text',
    clearTarget: 'slide',
    content: slide.lines[1] ?? '',
    frame: {x: 252, y: spacing.subtitleTop, w: 1416, h: 90},
    text: {...text, weight: 400, size: 64, tracking: spacing.subtitleTracking},
  };
  return {
    ...layout,
    elements: layout.elements.flatMap(element =>
      element.kind === 'currentText' ? [title, subtitle] : [element],
    ),
  };
}
