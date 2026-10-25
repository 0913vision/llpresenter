import {defineLayer} from '../layer';
import {SlideLayerView} from '../slideLayer';

export const lyricsLayer = defineLayer({
  kind: 'lyrics',
  order: 1,
  create: (parent, options) => {
    const view = new SlideLayerView(parent, options.lyricStyle);
    return {
      render: layers => view.show(layers.slide),
      rescale: scale => view.rescale(scale),
      dispose: () => view.dispose(),
    };
  },
});
