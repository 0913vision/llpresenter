import type {MediaChoice, SlideLayer} from '@core/schema/live/live';
import {mediaLoops} from '@core/media';
import type {SlideBackground} from '@core/schema/screens/theme';
import {setLayer, type LiveHistory} from '../history';
import type {SliceContext} from '../slice';

/** Puts media on its layer; the same one keeps playing from where it is. */
export function showMedia(
  history: LiveHistory,
  choice: MediaChoice,
  now: number,
): LiveHistory {
  const current = history.state.layers.media;
  if (current?.mediaId !== choice.mediaId) {
    return setLayer(history, 'media', {...choice, startedAt: now});
  }
  // NOTE(0913vision): The same background shown again keeps playing from
  // where it is, so it keeps its start time (docs/spec/03-output.md).
  if (
    current.loop === choice.loop &&
    current.itemId === choice.itemId &&
    current.title === choice.title &&
    current.chosen === choice.chosen
  ) {
    return history;
  }
  const {
    itemId: _itemId,
    title: _title,
    chosen: _chosen,
    ...playback
  } = current;
  return setLayer(history, 'media', {...playback, ...choice});
}

/**
 * The slide as it goes out: one whose own background file is missing shows
 * the background of its theme instead (USER Nov 26, spec 08 "Missing media
 * file"), so the screens never try a file that is gone.
 */
export function withShownBackground(
  slide: SlideLayer,
  context: Pick<SliceContext, 'isMissingMedia'>,
): SlideLayer {
  const {background} = slide;
  if (
    background?.kind !== 'media' ||
    context.isMissingMedia?.(background.media) !== true
  ) {
    return slide;
  }
  const {background: _missing, ...shown} = slide;
  return shown;
}

/** Puts what is behind a slide on the media layer. */
export function showBackground(
  history: LiveHistory,
  slide: SlideLayer,
  {context}: {readonly context: SliceContext},
): LiveHistory {
  const background: SlideBackground = slide.background ??
    context.themes?.background({theme: slide.theme, texts: slide.texts}) ?? {
      kind: 'none',
    };
  const library = context.audioMedia?.();
  if (
    background.kind === 'media' &&
    context.isMissingMedia?.(background.media) !== true
  ) {
    const item = library?.items.find(entry => entry.id === background.media);
    return context.apply(
      showMedia(
        history,
        {
          mediaId: background.media,
          loop: background.loop ?? (item === undefined || mediaLoops(item)),
          itemId: slide.itemId,
        },
        context.now,
      ),
      {type: 'media.properties.refresh'},
    );
  }
  const current = history.state.layers.media;
  if (current === null) return history;
  // NOTE(0913vision): A background the operator put on stays for the slides of
  // an item that have none, until the item ends or its file is gone.
  const stays =
    background.kind === 'none' &&
    current.chosen === true &&
    history.state.layers.slide?.itemId === slide.itemId &&
    (library === undefined ||
      library.items.some(item => item.id === current.mediaId));
  return stays ? history : setLayer(history, 'media', null);
}
