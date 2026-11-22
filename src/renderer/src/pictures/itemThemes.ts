import type {LlpApi} from '@contracts/ipc/api';
import {mediaTextSlide} from '@core/presentation/slideLayer';
import {
  isItemRow,
  type ServiceRow,
  type SlideTile,
} from '@core/presentation/model';
import type {SlideLayer} from '@core/live/state';
import {withPreferenceDefaults} from '@core/schema/preferences';
import {useApiSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {slideTheme} from '@renderer/platform/useSlideTheme';
import {sermonPreviewRow} from '@renderer/platform/sermonPreview';
import type {SlideInput} from '@renderer/rendering/slideStillSpec';

type SlideTheme = ReturnType<typeof slideTheme>;
type ThemeSettings = Parameters<typeof slideTheme>[1];

/** The themes of one item's slides on one screen. */
export interface ItemThemes {
  readonly theme: SlideTheme;
  readonly cardTheme: SlideTheme;
  readonly sermonTheme: SlideTheme;
}

export function itemThemes(
  row: ServiceRow | undefined,
  tiles: readonly SlideTile[],
  settings: ThemeSettings,
): ItemThemes {
  const card = tiles.find(tile => tile.sectionCard !== undefined)?.sectionCard;
  const sermon = tiles.some(tile => tile.sermonTitle === true);
  const {theme: _own, ...shared} = settings;
  return {
    theme: slideTheme(
      row !== undefined && isItemRow(row) ? row : undefined,
      settings,
    ),
    cardTheme: slideTheme(
      card === undefined || row === undefined
        ? undefined
        : {
            id: row.id,
            kind: 'slides',
            form: 'blank',
            title: card.name,
            theme: card.theme,
          },
      shared,
    ),
    sermonTheme: slideTheme(
      sermon && row?.kind === 'bible' && row.bible !== undefined
        ? sermonPreviewRow(row.id, row.bible.ref)
        : undefined,
      shared,
    ),
  };
}

/** The themes, screens and label setting every item's slides are drawn with. */
export function useThemeSettings({
  api = window.llp,
  source = 'service',
  role,
  screenId,
}: {
  readonly api?: LlpApi | undefined;
  readonly source?: ThemeSettings['source'];
  readonly role?: ThemeSettings['role'] | undefined;
  readonly screenId?: string | undefined;
} = {}): ThemeSettings & {readonly ready: boolean} {
  const themes = useApiSettingsDocument({api, name: 'themes', title: '테마'});
  const screens = useApiSettingsDocument({api, name: 'screens', title: '화면'});
  const preferences = useApiSettingsDocument({
    api,
    name: role === 'stage' ? 'preferences' : null,
    title: '환경설정',
  });
  return {
    ...(role === undefined ? {} : {role}),
    ...(screenId === undefined ? {} : {screenId}),
    source,
    file: themes?.value,
    screens: screens?.value.screens,
    ...(preferences === null
      ? {}
      : {
          stageLyricLabelPosition: withPreferenceDefaults(preferences.value)
            .output.stageLyricLabelPosition,
        }),
    ready: themes !== null && screens !== null,
  };
}

/** What draws a slide of an item, in the theme that slide has. */
export function tileInput(
  tile: SlideTile,
  slide: SlideLayer | null,
  {theme, cardTheme, sermonTheme}: ItemThemes,
): SlideInput | undefined {
  if (slide === null) return undefined;
  if (tile.sectionCard !== undefined) {
    return cardTheme === undefined ? undefined : {...cardTheme, slide};
  }
  if (tile.sermonTitle === true) {
    return sermonTheme === undefined ? undefined : {...sermonTheme, slide};
  }
  if (theme === undefined) return undefined;
  return tile.media === undefined
    ? {...theme, slide}
    : {
        ...theme,
        slide: mediaTextSlide(slide),
        background: tile.media.mediaId,
        mediaOnly: tile.texts === undefined,
      };
}
