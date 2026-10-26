import {defineLayer} from '../layer';
import {SlideLayerView} from '../slideLayer';

export const lyricsLayer = defineLayer({
  kind: 'lyrics',
  order: 1,
  look: 'slide',
  create: (parent, options) => {
    const view = new SlideLayerView(parent, options.lyricStyle);
    return {
      render: (layers, frame) => {
        view.setStyle(frame?.look?.lyricStyle ?? options.lyricStyle);
        view.show(layers.slide);
      },
      rescale: scale => view.rescale(scale),
      dispose: () => view.dispose(),
    };
  },
});
