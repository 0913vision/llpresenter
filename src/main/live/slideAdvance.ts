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
}: {
  readonly store: Pick<LiveStore, 'state' | 'subscribeCommands'>;
  readonly sequence: (id: string) => SlideSequence | undefined;
  readonly send: (command: LiveCommand) => void;
}): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observed = store.state.layers.slide;
  const cancel = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };
  const schedule = (slide: SlideLayer, source: SlideSequence): void => {
    const {advance, loop} = source.item.slides;
    const next = slide.position + 1;
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
          latest.tiles.length === 0 ||
          (next >= latest.tiles.length && !latest.item.slides.loop)
        ) {
          cancel();
          return;
        }
        const shown = slideLayerOf(
          {itemId: slide.itemId, index: next % latest.tiles.length},
          () => latest.tiles,
        );
        if (shown !== null) {
          send(slidesOutput(shown, latest.background));
        }
      }, delay);
    };
    wait();
  };
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
      cancel();
      return;
    }
    if (!changed && lastSlide < 0) return;
    const source = sequence(slide.itemId);
    cancel();
    if (source !== undefined && source.tiles.length > 0) {
      schedule(slide, source);
    }
  });
  return () => {
    cancel();
    stop();
  };
}

export function registerSlideAdvance({
  store,
  data,
  log,
}: {
  readonly store: LiveStore;
  readonly data: Pick<DataStore, 'content' | 'media'>;
  readonly log: Logger;
}): () => void {
  let disposed = false;
  let release: (() => void) | undefined;
  Promise.all([data.content, data.media])
    .then(([content, media]) => {
      if (disposed || content === null) return;
      release = followSlideAdvance({
        store,
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
          const library = new Map(
            media?.get().value.items.map(entry => [entry.id, entry]),
          );
          const background =
            item.background === undefined
              ? undefined
              : library.get(item.background);
          return {
            item,
            tiles: projectSlides(item, library),
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
