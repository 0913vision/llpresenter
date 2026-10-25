import {BackgroundLayerView} from '../backgroundLayer';
import {defineLayer} from '../layer';

export const backgroundLayer = defineLayer({
  kind: 'background',
  order: 0,
  create: (parent, options) => {
    const view = new BackgroundLayerView(parent, options);
    return {
      render: layers => view.show(layers.media),
      dispose: () => view.dispose(),
    };
  },
});
