import type {SingleLiveCommand} from '@core/live/commands';
import type {MediaChoice, SlideLayer} from '@core/live/state';
import {sendLive} from './live';

/** Puts a slide on output, with the start of its item. */
export function sendSlideOutput(
  slide: SlideLayer,
  start?: SingleLiveCommand,
): void {
  sendLive(
    start === undefined
      ? {type: 'slide.show', slide}
      : {type: 'live.batch', commands: [start, {type: 'slide.show', slide}]},
  );
}

/** A direct media choice replaces the slide; background macros stay separate. */
export function sendMediaOutput(media: MediaChoice): void {
  sendLive({
    type: 'live.batch',
    commands: [
      {type: 'layer.clear', target: 'slide'},
      {type: 'media.show', media},
    ],
  });
}
