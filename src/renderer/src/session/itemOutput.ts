import type {SingleLiveCommand} from '@core/live/commands';
import type {MediaChoice, SlideLayer} from '@core/live/state';
import {slidesOutput} from '@core/presentation/slides';
import {sendLive, useLive} from './live';

/** Publishes an item's start, own background, and selected text atomically. */
export function sendSlideOutput(
  slide: SlideLayer,
  background?: MediaChoice,
  start?: SingleLiveCommand,
): void {
  const live = useLive.getState();
  const entering =
    (live.lastStartedItemId ?? live.state?.layers.slide?.itemId) !==
    slide.itemId;
  const output = slidesOutput(
    slide,
    slide.sectionCard === undefined &&
      (entering ||
        live.state?.layers.slide?.sectionCard !== undefined ||
        live.state?.layers.slide?.picture !== undefined ||
        slide.kind === 'ad' ||
        slide.kind === 'blank')
      ? background
      : undefined,
  );
  const clearBackground =
    slide.sectionCard === undefined &&
    (entering || live.state?.layers.slide?.picture !== undefined) &&
    background === undefined &&
    slide.picture === undefined;
  sendLive({
    type: 'live.batch',
    commands: [
      ...(start === undefined ? [] : [start]),
      ...(clearBackground
        ? [{type: 'layer.clear', target: 'media'} as const]
        : []),
      ...output.commands,
    ],
  });
}

/** Updates a slide after a fresh read, replacing its background only if it changed. */
export function correctSlideOutput(
  slide: SlideLayer,
  options: {background?: MediaChoice | undefined; backgroundChanged: boolean},
): void {
  const output = slidesOutput(
    slide,
    options.backgroundChanged ? options.background : undefined,
  );
  const clear =
    options.backgroundChanged &&
    options.background === undefined &&
    slide.picture === undefined &&
    slide.sectionCard === undefined;
  sendLive({
    type: 'live.batch',
    commands: [
      ...(clear ? [{type: 'layer.clear', target: 'media'} as const] : []),
      ...output.commands,
    ],
  });
}

/** A direct media choice replaces slide text; background macros stay separate. */
export function sendMediaOutput(
  media: MediaChoice,
  start?: SingleLiveCommand,
  textSlide?: SlideLayer,
): void {
  sendLive({
    type: 'live.batch',
    commands: [
      ...(start === undefined ? [] : [start]),
      textSlide === undefined
        ? {type: 'layer.clear', target: 'slide'}
        : {type: 'slide.show', slide: textSlide},
      {type: 'media.show', media},
    ],
  });
}
