import {BIBLE_BOOKS, displayReference} from '@core/bible';
import {hymnAt, hymnLabel, hymnTitle} from '@core/hymns';
import {NO_LABEL_COLOR, type LabelColor} from '@core/labels';
import type {Hymn} from '@core/schema/hymn';
import type {ShowTile} from '@core/schema/showService';
import {
  hasSlides,
  type ServiceItem,
  type SlidesItem,
} from '@core/schema/service';
import type {Slide} from '@core/schema/slide';
import {
  type SlideContent,
  AUTO_TOKENS,
  type AutoValues,
} from '@core/schema/slideContent';
import type {Song} from '@core/schema/song';
import {verseKey} from './passageSlides';

/** What an item says about its slides beside the slides themselves. */
export interface SlideSource {
  readonly kind: SlidesItem['kind'];
  readonly title: string;
  /** The address of the passage the item is made of. */
  readonly passage?: string | undefined;
}

/** The song's name after its hymn number, from its name or its title slide. */
function nameWithHymn(name: string, shown: Hymn | undefined): string {
  const title = name.split(/\r?\n/u)[0]?.trim() ?? '';
  const named = hymnAt(title);
  const hymn = named?.hymn ?? shown;
  if (hymn === undefined) return title;
  const own = named === null ? title : named.rest;
  return `${hymnLabel(hymn)} ${own || hymnTitle(hymn)}`;
}

/** The values a theme can use on each slide of a list. */
export function autoValues(
  slides: readonly Slide[],
  source: SlideSource,
): readonly AutoValues[] {
  const counts = new Map<string, number>();
  const named =
    source.kind === 'song'
      ? nameWithHymn(source.title, slides[0]?.hymn)
      : undefined;
  return slides.map((slide, index) => {
    const number = (counts.get(slide.theme) ?? 0) + 1;
    counts.set(slide.theme, number);
    const {label, hymn} = slide;
    const repeated = label !== undefined && slides[index - 1]?.label === label;
    return {
      [AUTO_TOKENS.number]: String(number),
      [AUTO_TOKENS.item]: source.title,
      ...(label === undefined ? {} : {[AUTO_TOKENS.label]: label}),
      ...(label === undefined || repeated
        ? {}
        : {[AUTO_TOKENS.newLabel]: label}),
      ...(source.passage === undefined
        ? {}
        : {[AUTO_TOKENS.passage]: source.passage}),
      ...(source.kind === 'song' ? {[AUTO_TOKENS.song]: source.title} : {}),
      ...(named === undefined ? {} : {[AUTO_TOKENS.hymn]: named}),
      ...(hymn === undefined
        ? {}
        : {
            [AUTO_TOKENS.hymnNumber]: hymnLabel(hymn),
            [AUTO_TOKENS.hymnTitle]: hymnTitle(hymn),
          }),
    };
  });
}

/** What a tile is called under its picture. */
function captions(
  slides: readonly Slide[],
  kind: SlidesItem['kind'],
): ReadonlyArray<string | null> {
  const parts = new Map<string, number>();
  for (const {verse} of slides) {
    if (verse === undefined) continue;
    const key = verseKey(verse);
    parts.set(key, (parts.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return slides.map(slide => {
    const {verse, label} = slide;
    if (verse !== undefined) {
      const key = verseKey(verse);
      const part = (seen.get(key) ?? 0) + 1;
      seen.set(key, part);
      if (label === undefined) {
        const book = BIBLE_BOOKS.find(entry => entry.id === verse.book);
        const name = `${book?.koreanShort ?? ''}${verse.chapter}:${verse.verse}`;
        return (parts.get(key) ?? 0) > 1 ? `${name} (${part})` : name;
      }
    }
    if (label !== undefined) return label;
    if (kind === 'song') return null;
    const text = Object.values(slide.texts).find(value => value.trim() !== '');
    return text?.trim().split('\n')[0] ?? null;
  });
}

/** The slides of a list as tiles, with everything that is worked out for them. */
export function slideTiles(
  slides: readonly Slide[],
  source: SlideSource,
  colors: ReadonlyMap<string, LabelColor> = new Map(),
): readonly ShowTile[] {
  const autos = autoValues(slides, source);
  const names = captions(slides, source.kind);
  return slides.map((slide, index) => ({
    slide,
    auto: autos[index] ?? {},
    caption: names[index] ?? null,
    labelColor:
      slide.label === undefined
        ? NO_LABEL_COLOR
        : (colors.get(slide.label) ?? NO_LABEL_COLOR),
  }));
}

/** The texts of a tile, as its theme draws them. */
export function tileContent({slide, auto}: ShowTile): SlideContent {
  return {
    texts: slide.texts,
    auto,
    ...(slide.next === undefined ? {} : {next: slide.next}),
    ...(slide.continued === undefined ? {} : {continued: true}),
  };
}

/** What an item is called: its own name, or what its slides are. */
export function itemTitle(item: ServiceItem): string {
  if (!hasSlides(item)) return item.name;
  if (item.kind === 'bible') return displayReference(item.passage.ref);
  if (item.kind !== 'sermon') return item.name;
  const title = item.slides.find(
    slide => (slide.texts['제목'] ?? '').trim() !== '',
  )?.texts['제목'];
  return title?.trim().split('\n')[0] ?? item.name;
}

/** What an item says about its slides. */
export function slideSourceOf(item: SlidesItem): SlideSource {
  return {
    kind: item.kind,
    title: itemTitle(item),
    ...('passage' in item ? {passage: displayReference(item.passage.ref)} : {}),
  };
}

export function itemTiles(
  item: SlidesItem,
  colors?: ReadonlyMap<string, LabelColor>,
): readonly ShowTile[] {
  return slideTiles(item.slides, slideSourceOf(item), colors);
}

export function songTiles(
  song: Pick<Song, 'title' | 'slides'>,
  colors?: ReadonlyMap<string, LabelColor>,
): readonly ShowTile[] {
  return slideTiles(song.slides, {kind: 'song', title: song.title}, colors);
}
