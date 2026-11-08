import {BackgroundLayerView} from '../backgroundLayer';
import {defineLayer} from '../layer';

export const backgroundLayer = defineLayer({
  kind: 'background',
  order: 0,
  fades: 'media',
  create: (parent, options) => {
    const view = new BackgroundLayerView(parent, options);
    return {
      render: (layers, frame) => {
        if (frame?.transitionTimes !== undefined) {
          view.setDissolveMs(frame.transitionTimes.backgroundMs);
        }
        if (frame?.clearOpacity?.media !== undefined) view.hold();
        else view.show(layers.media, frame?.transitions, frame?.standby);
      },
      ready: () => view.ready(),
      dispose: () => view.dispose(),
    };
  },
});
