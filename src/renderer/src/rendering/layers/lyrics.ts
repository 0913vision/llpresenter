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
        // NOTE(0913vision): A 무대 화면 with a stage layout draws its 장 in the
        // layout's elements instead.
        view.show(frame?.stage === undefined ? layers.slide : null);
      },
      rescale: scale => view.rescale(scale),
      dispose: () => view.dispose(),
    };
  },
});
