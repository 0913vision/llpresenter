import {defineLayer} from '../layer';
import {SlideLayerView} from '../slideLayer';

export const lyricsLayer = defineLayer({
  kind: 'lyrics',
  order: 1,
  fades: 'slide',
  create: (parent, options) => {
    const view = new SlideLayerView(parent, options.textStyle);
    return {
      render: (layers, frame) => {
        if (frame?.transitionTimes !== undefined) {
          view.setDissolveMs(frame.transitionTimes.slideMs);
        }
        view.setStyle(options.textStyle);
        view.show(layers.slide);
      },
      rescale: scale => view.rescale(scale),
      dispose: () => view.dispose(),
    };
  },
});
