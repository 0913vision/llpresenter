import {defineLayer} from '../layer';
import {StageLayoutView} from '../stageLayout';

export const stageLayoutLayer = defineLayer({
  kind: 'stage-layout',
  order: 3,
  create: (parent, options) => {
    const view = new StageLayoutView(parent, options.onError);
    return {
      render: (layers, frame) => view.render(layers, frame),
      rescale: () => view.rescale(),
      dispose: () => view.dispose(),
    };
  },
});
