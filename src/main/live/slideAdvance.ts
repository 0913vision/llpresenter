import type {LiveCommand} from '@core/live/commands';
import type {MediaChoice, SlideLayer} from '@core/live/state';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import {projectSlides, slidesOutput} from '@core/presentation/slides';
import {slideLayerOf} from '@core/presentation/slideLayer';
import type {ShowTile} from '@core/schema/showService';
import {mediaLoops} from '@core/media/mediaEndRule';
import type {DataStore} from '../store/register';
import type {Logger} from '../log';
import {dispatchLogged, type LiveStore} from './store';
import type {SlidesProjectionReader} from './slidesProjection';
import {biblePartIndex} from '@core/bible/selection';

interface SlideSequence {
  readonly item: ServiceItemOf<'slides'>;
  readonly tiles: readonly ShowTile[];
  readonly background?: MediaChoice;
}

const MAX_TIMEOUT_MS = 2_147_483_647;

/** Owns one timer for the live sequence, independent of renderer window lifetime. */
export function followSlideAdvance({
  store,
  sequence,
  send,
  subscribeSequence,
}: {
  readonly store: Pick<LiveStore, 'state' | 'subscribeCommands'>;
  readonly sequence: (id: string) => SlideSequence | undefined;
  readonly send: (command: LiveCommand) => void;
  readonly subscribeSequence?: (listener: () => void) => () => void;
}): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observed = store.state.layers.slide;
  let running = false;
  const cancel = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };
  const schedule = (slide: SlideLayer, source: SlideSequence): void => {
    const {advance, loop} = source.item.slides;
    const current =
      slide.sourceSlideId === undefined
        ? slide.position
        : biblePartIndex(source.tiles, {
            label: slide.label,
            part: slide.biblePart ?? 1,
            sourceSlideId: slide.sourceSlideId,
          });
    if (current === null) return;
    const next = current + 1;
    if (advance === undefined || (next >= source.tiles.length && !loop)) return;
    let remaining = advance * 1000;
    const wait = (): void => {
      const delay = Math.min(remaining, MAX_TIMEOUT_MS);
      remaining -= delay;
      timer = setTimeout(() => {
        timer = undefined;
        if (remaining > 0) {
          wait();
          return;
        }
        const latest = sequence(slide.itemId);
        if (
          store.state.layers.slide !== slide ||
          latest?.item.slides.advance === undefined ||
          latest.tiles.length === 0
        ) {
          cancel();
          return;
        }
        const current =
          slide.sourceSlideId === undefined
            ? slide.position
            : biblePartIndex(latest.tiles, {
                label: slide.label,
                part: slide.biblePart ?? 1,
                sourceSlideId: slide.sourceSlideId,
              });
        if (
          current === null ||
          (current + 1 >= latest.tiles.length && !latest.item.slides.loop)
        ) {
          return;
        }
        const shown = slideLayerOf(
          {itemId: slide.itemId, index: (current + 1) % latest.tiles.length},
          () => latest.tiles,
        );
        if (shown !== null) {
          send(slidesOutput(shown, latest.background));
        }
      }, delay);
    };
    wait();
  };
  const refresh = (): void => {
    cancel();
    if (!running) return;
    const slide = store.state.layers.slide;
    if (
      slide === null ||
      store.state.themeItem?.contentCleared ||
      (store.state.themeItem != null &&
        store.state.themeItem.id !== slide.itemId)
    ) {
      return;
    }
    const source = sequence(slide.itemId);
    if (source !== undefined && source.tiles.length > 0) {
      schedule(slide, source);
    }
  };
  const stopSequence = subscribeSequence?.(refresh);
  const stop = store.subscribeCommands(commands => {
    const lastSlide = commands.findLastIndex(
      value => value.type === 'slide.show',
    );
    const lastStop = commands.findLastIndex(value =>
      ['layer.clear', 'layer.clear.toggle', 'item.stop'].includes(value.type),
    );
    const slide = store.state.layers.slide;
    const changed = slide !== observed;
    observed = slide;
    if (
      lastStop > lastSlide ||
      slide === null ||
      store.state.themeItem?.contentCleared ||
      (store.state.themeItem != null &&
        store.state.themeItem.id !== slide.itemId)
    ) {
      running = false;
      cancel();
      return;
    }
    if (!changed && lastSlide < 0) return;
    running = lastSlide >= 0;
    const source = sequence(slide.itemId);
    cancel();
    if (running && source !== undefined && source.tiles.length > 0) {
      schedule(slide, source);
    }
  });
  return () => {
    cancel();
    stop();
    stopSequence?.();
  };
}

export function registerSlideAdvance({
  store,
  data,
  log,
  projection,
}: {
  readonly store: LiveStore;
  readonly data: Pick<DataStore, 'content' | 'media'>;
  readonly log: Logger;
  readonly projection?: SlidesProjectionReader;
}): () => void {
  let disposed = false;
  let release: (() => void) | undefined;
  Promise.all([data.content, data.media])
    .then(([content, media]) => {
      if (disposed || content === null) return;
      release = followSlideAdvance({
        store,
        ...(projection === undefined
          ? {}
          : {subscribeSequence: projection.subscribe}),
        sequence: id => {
          const serviceId = content.openServiceId;
          const item =
            serviceId === null
              ? undefined
              : content
                  .service(serviceId)
                  ?.service.order.find(entry => entry.id === id);
          if (item === undefined || !isItemOfKind(item, 'slides')) {
            return undefined;
          }
          const revision =
            serviceId === null
              ? undefined
              : content.service(serviceId)?.revision;
          const projected =
            serviceId === null || revision === undefined
              ? undefined
              : projection?.get(serviceId, item.id, revision);
          if (
            projected === undefined &&
            item.slides.slides.some(slide => 'verse' in slide)
          ) {
            return undefined;
          }
          const library = new Map(
            media?.get().value.items.map(entry => [entry.id, entry]),
          );
          const background =
            item.background === undefined
              ? undefined
              : library.get(item.background);
          return {
            item,
            tiles: projected ?? projectSlides(item, library),
            ...(background === undefined
              ? {}
              : {
                  background: {
                    mediaId: background.id,
                    loop: mediaLoops(background),
                  },
                }),
          };
        },
        send: command => dispatchLogged(store, command, log),
      });
    })
    .catch((error: unknown) =>
      log.error('could not start slide advance', error),
    );
  return () => {
    disposed = true;
    release?.();
  };
}
