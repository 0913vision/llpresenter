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
    entering || slide.kind === 'ad' || slide.kind === 'blank'
      ? background
      : undefined,
  );
  const clearBackground =
    entering && background === undefined && slide.picture === undefined;
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

/** A direct media choice replaces slide text; background macros stay separate. */
export function sendMediaOutput(
  media: MediaChoice,
  start?: SingleLiveCommand,
): void {
  sendLive({
    type: 'live.batch',
    commands: [
      ...(start === undefined ? [] : [start]),
      {type: 'layer.clear', target: 'slide'},
      {type: 'media.show', media},
    ],
  });
}
