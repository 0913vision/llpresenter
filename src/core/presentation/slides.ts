import type {LiveBatch, SingleLiveCommand} from '../live/commands';
import type {MediaChoice, SlideLayer} from '../live/state';
import {NO_LABEL_COLOR, type LabelColor} from '../labels/colors';
import type {MediaItem} from '../schema/mediaList';
import type {ServiceItemOf} from '../schema/service';
import type {ShowTile} from '../schema/showService';
import type {BibleLookupPassage} from '../schema/bibleLookup';
import {BIBLE_BOOKS} from '../bible/bibleBooks';
import {bibleOutputLines} from '../bible/bibleTiles';
import {continuationText} from '../bible/split/continuation';
import {textOverridesForTiles} from './textOverrides';

/** Projects both slide forms without putting thumbnail bands into live text. */
export function projectSlides(
  item: ServiceItemOf<'slides'>,
  media: ReadonlyMap<string, MediaItem> = new Map(),
  passages: ReadonlyMap<string, BibleLookupPassage> = new Map(),
): readonly ShowTile[] {
  const tiles = item.slides.slides.map((slide): ShowTile => {
    const label = slide.label;
    const labelColor = NO_LABEL_COLOR;
    const assigned = label === undefined ? {} : {slideLabel: label};
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
      label:
        label ??
        (item.slides.form === 'ad'
          ? (name ?? '')
          : (text.split('\n')[0] ?? '')),
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
