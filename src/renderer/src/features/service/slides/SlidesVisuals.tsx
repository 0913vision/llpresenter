import {useMemo, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {parseMediaId} from '@core/schema/ids';
import type {SlideLayer} from '@core/live/state';
import type {MediaItem} from '@core/schema/mediaList';
import type {ThemesFile} from '@core/schema/themes';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {adSlideTitle, projectSlides} from '@core/presentation/slides';
import type {ItemRow} from '@core/presentation/model';
import type {Slide, SlidesItem} from '@core/services/slidesEdits';
import {cardOffset, withSectionCard} from '@core/services/sectionCards';
import {
  itemThemes,
  useThemeSettings,
  type ItemThemes,
} from '@renderer/pictures/itemThemes';
import {TilePicture} from '@renderer/pictures/TilePicture';
import {useShow} from '@renderer/session/show';
import type {PreviewRole} from '@renderer/features/songs/editor/songPreviewModel';
import {RolePreview} from '@renderer/features/songs/editor/RolePreview';
import styles from './SlidesEditor.module.css';

/** The name under a slide's thumbnail. */
export function slideBand(
  item: SlidesItem,
  slide: Slide,
  media: readonly MediaItem[],
): string {
  if (item.slides.form === 'ad') return adSlideTitle(item, slide);
  if (slide.label !== undefined) return slide.label;
  if ('verse' in slide) {
    const book = BIBLE_BOOKS.find(book => book.id === slide.verse.book);
    return `${book?.korean ?? '성경'} ${slide.verse.chapter}:${slide.verse.verse}`;
  }
  if ('media' in slide) {
    const file = media.find(file => file.id === slide.media);
    if (file?.internal === true) return '';
    return file?.file.split(/[\\/]/).at(-1) ?? file?.name ?? '미디어 없음';
  }
  const reference = slide.reference?.trim() ?? '';
  return reference === '' ? (slide.text.split('\n')[0] ?? '') : reference;
}

/** Combines the current projected background with the editor's unsaved slide draft. */
export function useSlidesItemWithBackground(draftItem: SlidesItem): SlidesItem {
  const row = useShow(view =>
    view.rows.find(entry => entry.id === draftItem.id),
  );
  if (row?.kind !== 'slides') return draftItem;
  const parsed = parseMediaId(row.background?.mediaId);
  const {background: _background, ...item} = draftItem;
  return {...item, ...(parsed.ok ? {background: parsed.value} : {})};
}

function rowOf(item: SlidesItem): ItemRow {
  return {
    id: item.id,
    kind: 'slides',
    form: item.slides.form,
    title: item.slides.name,
    ...(item.theme === undefined ? {} : {theme: item.theme}),
    ...(item.backgroundNone === true ? {backgroundNone: true as const} : {}),
    ...(item.background === undefined
      ? {}
      : {background: {mediaId: item.background, loop: true}}),
  };
}

function tilesOf(item: SlidesItem) {
  return withSectionCard(item.sectionCard, projectSlides(item));
}

function themeNameOf(themes: ItemThemes, file: ThemesFile | undefined): string {
  const id = themes.theme?.themeId;
  if (file !== undefined && id === file.standby.id) return file.standby.name;
  const deleted = file?.deletedThemes?.find(theme => theme.id === id);
  if (deleted !== undefined) return `(${deleted.name})`;
  return file?.themes.find(theme => theme.id === id)?.name ?? '기본';
}

/** The themes a slides item is drawn with on the screen of a role. */
export function useSlidesThemes(
  item: SlidesItem,
  options: {
    readonly api?: LlpApi | undefined;
    readonly role?: PreviewRole | undefined;
    readonly screenId?: string | undefined;
  } = {},
) {
  const settings = useThemeSettings(options);
  const themes = itemThemes(rowOf(item), tilesOf(item), settings);
  return {
    themes,
    file: settings.file,
    themeName: themeNameOf(themes, settings.file),
    ready: settings.ready,
  };
}

/** A slide of the draft, drawn as its screen will show it. */
export function SlidesCanvas({
  item,
  index,
  themes,
  outputSlide,
}: {
  readonly item: SlidesItem;
  readonly index: number;
  readonly themes: ItemThemes;
  readonly outputSlide?: SlideLayer | null;
}): JSX.Element | null {
  const tiles = useMemo(() => tilesOf(item), [item]);
  const position = index + cardOffset(item);
  const tile = tiles[position];
  if (tile === undefined) return null;
  return (
    <TilePicture
      tile={tile}
      slide={
        outputSlide ??
        slideLayerOf({itemId: item.id, index: position}, () => tiles)
      }
      themes={themes}
    />
  );
}

export function SlidesPreview({
  api,
  item,
  selected,
  media,
  offset = 0,
}: {
  readonly api?: LlpApi | undefined;
  readonly item: SlidesItem;
  readonly selected: number;
  readonly offset?: number;
  readonly media: readonly MediaItem[];
}): JSX.Element {
  const [role, setRole] = useState<PreviewRole>('audience');
  const audience = useSlidesThemes(item, {api, role: 'audience'});
  const stage = useSlidesThemes(item, {api, role: 'stage'});
  const broadcast = useSlidesThemes(item, {api, role: 'broadcast'});
  const shown = {audience, stage, broadcast};
  const slide = item.slides.slides[selected];
  return (
    <RolePreview
      big={role}
      onBigChange={setRole}
      renderRole={forRole => (
        <div className={styles.canvas}>
          <SlidesCanvas
            item={item}
            index={selected}
            themes={shown[forRole].themes}
          />
        </div>
      )}
      caption={() => (
        <>
          {slide === undefined ? null : (
            <>
              <span>{slideBand(item, slide, media)}</span>
              <span>
                {selected + 1 + offset} / {item.slides.slides.length + offset}
              </span>
            </>
          )}
          <span className={styles.themeName}>{shown[role].themeName}</span>
        </>
      )}
    />
  );
}
