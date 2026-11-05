import type {LiveBatch, SingleLiveCommand} from '../live/commands';
import type {MediaChoice, SlideLayer} from '../live/state';
import {NO_LABEL_COLOR} from '../labels/colors';
import type {MediaItem} from '../schema/mediaList';
import type {ServiceItemOf} from '../schema/service';
import type {ShowTile} from '../schema/showService';

/** Projects both slide forms without putting thumbnail bands into live text. */
export function projectSlides(
  item: ServiceItemOf<'slides'>,
  media: ReadonlyMap<string, MediaItem> = new Map(),
): readonly ShowTile[] {
  return item.slides.slides.map(slide => {
    if ('verse' in slide) {
      return {
        label: `${slide.verse.chapter}:${slide.verse.verse}`,
        labelColor: NO_LABEL_COLOR,
        lines: [],
        kind: item.slides.form,
      };
    }
    if ('media' in slide) {
      const picture = media.get(slide.media);
      return {
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
  if (media !== undefined) commands.push({type: 'media.show', media});
  commands.push({type: 'slide.show', slide});
  return {type: 'live.batch', commands};
}
