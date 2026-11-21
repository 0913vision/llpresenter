import type {LiveBatch, SingleLiveCommand} from '../live/commands';
import type {MediaChoice, SlideLayer} from '../live/state';
import {NO_LABEL_COLOR, type LabelColor} from '../labels/colors';
import type {MediaItem} from '../schema/mediaList';
import type {ServiceItemOf} from '../schema/service';
import type {ShowTile} from '../schema/showService';
import type {ThemesFile} from '../schema/themes';
import {createScreenId} from '../schema/ids';
import type {SettingsDocument} from '../schema/settingsDocuments';
import type {ThemeScreen} from '../themes/defaults';
import {isThemeTextElement} from '../themes/content';
import {resolveItemTheme, resolveThemeScreen} from '../themes/resolve';
import {matchSlideText} from '../themes/textSlots';
import type {TextSlotLayout} from '../themes/textBindings';
import type {BibleLookupPassage} from '../schema/bibleLookup';
import {BIBLE_BOOKS} from '../bible/bibleBooks';
import {bibleOutputLines} from '../bible/bibleTiles';
import {continuationText} from '../bible/split/continuation';
import {slideTextValue, textOverridesForTiles} from './textOverrides';

type SlidesItem = ServiceItemOf<'slides'>;
type Slide = SlidesItem['slides']['slides'][number];
export type AdSlideTitle = (slide: Slide) => string;

export interface AdTitleSettings {
  readonly file: ThemesFile | null;
  readonly screens: readonly ThemeScreen[];
}

export function adTitleSettingsFrom(
  themes: SettingsDocument | null | undefined,
  screens: SettingsDocument | null | undefined,
): AdTitleSettings | undefined {
  return screens?.name === 'screens'
    ? {
        file: themes?.name === 'themes' ? themes.value : null,
        screens: screens.value.screens,
      }
    : undefined;
}

/** Uses the effective theme and the same bindings as the per-slide title field. */
export function adSlideTitles(
  item: SlidesItem,
  settings?: AdTitleSettings,
): AdSlideTitle | undefined {
  if (item.slides.form !== 'ad') return undefined;
  const automatic = (slide: Slide): string =>
    'text' in slide && slide.name?.trim() ? slide.name : item.slides.name;
  if (item.textOverrides === undefined) return automatic;
  const screens = settings?.screens;
  const theme = resolveItemTheme({
    file: settings?.file,
    kind: 'ad',
    source: 'service',
    ...(item.theme === undefined ? {} : {theme: item.theme}),
    ...(screens === undefined ? {} : {screens}),
  });
  const layouts: TextSlotLayout[] =
    screens === undefined
      ? Object.entries(theme.screens).map(([id, layout]) => ({
          themeId: theme.id,
          sourceScreenId: createScreenId(id),
          layout,
        }))
      : screens.map(screen => ({
          themeId: theme.id,
          ...resolveThemeScreen(theme, screen.id, screens),
        }));
  const fields = layouts.flatMap(layout =>
    layout.layout.elements
      .filter(isThemeTextElement)
      .filter(
        element => (element.textSlot?.role ?? element.kind) === 'slideName',
      )
      .map(element => ({layout, element})),
  );
  return slide => {
    if (!('text' in slide)) return automatic(slide);
    const values = item.textOverrides?.[`slide:${slide.id}`];
    for (const {layout, element} of fields) {
      const title = slideTextValue(
        matchSlideText(values, layout, element)?.value,
      );
      if (title !== undefined) return title;
    }
    return automatic(slide);
  };
}

/** Projects both slide forms without putting thumbnail bands into live text. */
export function projectSlides(
  item: SlidesItem,
  media: ReadonlyMap<string, MediaItem> = new Map(),
  {
    passages = new Map(),
    adTitleSettings,
  }: {
    readonly passages?: ReadonlyMap<string, BibleLookupPassage> | undefined;
    readonly adTitleSettings?: AdTitleSettings | undefined;
  } = {},
): readonly ShowTile[] {
  const adTitle = adSlideTitles(item, adTitleSettings);
  const tiles = item.slides.slides.map((slide): ShowTile => {
    const label = adTitle === undefined ? slide.label : adTitle(slide);
    const labelColor = NO_LABEL_COLOR;
    const assigned =
      adTitle !== undefined || label === undefined ? {} : {slideLabel: label};
    if ('verse' in slide) {
      const reference = slide.verse;
      const verse = passages
        .get(slide.id)
        ?.verses.find(
          verse =>
            verse.chapter === reference.chapter &&
            verse.verse === reference.verse,
        );
      const book = BIBLE_BOOKS.find(book => book.id === reference.book);
      return {
        sourceSlideId: slide.id,
        ...(slide.transition === undefined
          ? {}
          : {transition: slide.transition}),
        label:
          label ??
          `${book?.koreanShort ?? ''}${reference.chapter}:${reference.verse}`,
        labelColor,
        ...assigned,
        lines: verse === undefined ? [] : bibleOutputLines(verse.text),
        reference: `${book?.korean ?? '성경'} ${reference.chapter}:${reference.verse}`,
        verse: {
          reference,
          ...(slide.cut === undefined ? {} : {cut: slide.cut}),
          ...(verse === undefined ? {} : {text: verse.text}),
        },
        kind: item.slides.form,
      };
    }
    const storedReference = 'reference' in slide ? slide.reference : undefined;
    const reference = storedReference?.trim()
      ? {reference: storedReference}
      : {};
    if ('media' in slide) {
      const picture = media.get(slide.media);
      return {
        sourceSlideId: slide.id,
        ...(slide.transition === undefined
          ? {}
          : {transition: slide.transition}),
        label:
          label ??
          (picture?.internal === true
            ? ''
            : (picture?.file.split(/[\\/]/).at(-1) ?? '찾을 수 없는 그림')),
        labelColor,
        ...assigned,
        ...reference,
        lines: [],
        picture: slide.media,
        kind: item.slides.form,
      };
    }
    const text = slide.text;
    const trimmed = text.trimEnd();
    const continued =
      reference.reference !== undefined &&
      continuationText(trimmed, true).marker !== '';
    const name = typeof slide.name === 'string' ? slide.name : undefined;
    return {
      sourceSlideId: slide.id,
      ...(slide.transition === undefined ? {} : {transition: slide.transition}),
      label: label ?? text.split('\n')[0] ?? '',
      labelColor,
      ...assigned,
      ...reference,
      lines: [continued ? trimmed : text],
      ...(continued ? {continued} : {}),
      kind: item.slides.form,
      ...(name === undefined ? {} : {name}),
    };
  });
  return textOverridesForTiles(tiles, item.textOverrides);
}

/** Resolves catalog colors without changing the source slide labels. */
export function colorSlideLabels(
  tiles: readonly ShowTile[],
  colors: ReadonlyMap<string, LabelColor>,
): readonly ShowTile[] {
  let result: ShowTile[] | undefined;
  for (const [index, tile] of tiles.entries()) {
    if (tile.slideLabel === undefined) continue;
    const labelColor = colors.get(tile.slideLabel) ?? NO_LABEL_COLOR;
    if (labelColor === tile.labelColor) continue;
    result ??= [...tiles];
    result[index] = {...tile, labelColor};
  }
  return result ?? tiles;
}

/** Sends a slide picture or item background and its text in one transaction. */
export function slidesOutput(
  slide: SlideLayer,
  background: MediaChoice | undefined,
): LiveBatch {
  const commands: SingleLiveCommand[] = [];
  const media: MediaChoice | undefined =
    slide.picture === undefined
      ? background
      : {
          mediaId: slide.picture,
          loop: slide.kind === undefined,
          ...(slide.kind === undefined
            ? {}
            : {itemId: slide.itemId, slidePicture: true as const}),
        };
  if (slide.sectionCard !== undefined) {
    commands.push({type: 'layer.clear', target: 'media'});
  } else if (media !== undefined) commands.push({type: 'media.show', media});
  commands.push({type: 'slide.show', slide});
  return {type: 'live.batch', commands};
}
