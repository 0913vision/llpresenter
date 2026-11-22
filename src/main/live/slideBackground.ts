import type {MediaChoice, SlideLayer} from '@core/live/state';
import {mediaLoops} from '@core/media/mediaEndRule';
import type {ThemeId} from '@core/schema/ids';
import type {SlideBackground} from '@core/schema/theme';
import {setLayer, type LiveHistory} from './history';
import type {SliceContext} from './slice';

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

/** The theme the operator chose for the slides of the live item. */
function chosenTheme(
  {state}: LiveHistory,
  slide: SlideLayer,
): ThemeId | undefined {
  return state.item?.id === slide.itemId ? state.themeMode?.id : undefined;
}

/** Puts what is behind a slide on the media layer. */
export function showBackground(
  history: LiveHistory,
  slide: SlideLayer,
  {
    context,
    theme = chosenTheme(history, slide) ?? slide.theme,
  }: {
    readonly context: SliceContext;
    /** The theme the operator chooses now. */
    readonly theme?: ThemeId;
  },
): LiveHistory {
  const background: SlideBackground = slide.background ??
    context.themes?.background({theme, texts: slide.texts}) ?? {kind: 'none'};
  const library = context.audioMedia?.();
  if (background.kind === 'media') {
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
