import {BackgroundLayerView} from '../backgroundLayer';
import {defineLayer} from '../layer';

export const backgroundLayer = defineLayer({
  kind: 'background',
  order: 0,
  look: 'media',
  create: (parent, options) => {
    const view = new BackgroundLayerView(parent, options);
    return {
      render: (layers, frame) => {
        if (frame?.clearOpacity?.media !== undefined) view.hold();
        else view.show(layers.media, frame?.transitions);
      },
      ready: () => view.ready(),
      dispose: () => view.dispose(),
    };
  },
});
