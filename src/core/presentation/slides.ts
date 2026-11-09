import type {LiveBatch, SingleLiveCommand} from '../live/commands';
import type {MediaChoice, SlideLayer} from '../live/state';
import {NO_LABEL_COLOR} from '../labels/colors';
import type {MediaItem} from '../schema/mediaList';
import type {ServiceItemOf} from '../schema/service';
import type {ShowTile} from '../schema/showService';
import type {BibleLookupPassage} from '../schema/bibleLookup';
import {BIBLE_BOOKS} from '../bible/bibleBooks';
import {bibleOutputLines} from '../bible/bibleTiles';

/** Projects both slide forms without putting thumbnail bands into live text. */
export function projectSlides(
  item: ServiceItemOf<'slides'>,
  media: ReadonlyMap<string, MediaItem> = new Map(),
  passages: ReadonlyMap<string, BibleLookupPassage> = new Map(),
): readonly ShowTile[] {
  return item.slides.slides.map(slide => {
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
        label: `${slide.verse.chapter}:${slide.verse.verse}`,
        labelColor: NO_LABEL_COLOR,
        lines: verse === undefined ? [] : bibleOutputLines(verse.text),
        reference: `${book?.korean ?? '성경'} ${reference.chapter}:${reference.verse}`,
        verse: {reference, ...(verse === undefined ? {} : {text: verse.text})},
        kind: item.slides.form,
      };
    }
    if ('media' in slide) {
      const picture = media.get(slide.media);
      return {
        sourceSlideId: slide.id,
        ...(slide.transition === undefined
          ? {}
          : {transition: slide.transition}),
        label: picture?.file.split(/[\\/]/).at(-1) ?? '찾을 수 없는 그림',
        labelColor: NO_LABEL_COLOR,
        lines: [],
        picture: slide.media,
        kind: item.slides.form,
      };
    }
    const text = slide.text;
    const name =
      item.slides.form === 'ad' && typeof slide.name === 'string'
        ? slide.name
        : undefined;
    return {
      sourceSlideId: slide.id,
      ...(slide.transition === undefined ? {} : {transition: slide.transition}),
      label:
        item.slides.form === 'ad' ? (name ?? '') : (text.split('\n')[0] ?? ''),
      labelColor: NO_LABEL_COLOR,
      lines: [text],
      kind: item.slides.form,
      ...(name === undefined ? {} : {name}),
    };
  });
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
          loop: false,
          itemId: slide.itemId,
          slidePicture: true,
        };
  if (slide.sectionCard !== undefined) {
    commands.push({type: 'layer.clear', target: 'media'});
  } else if (media !== undefined) commands.push({type: 'media.show', media});
  commands.push({type: 'slide.show', slide});
  return {type: 'live.batch', commands};
}
