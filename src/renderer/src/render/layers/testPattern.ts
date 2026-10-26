import {defineLayer} from '../layer';
import {TestPatternView} from '../testPattern';

export const testPatternLayer = defineLayer({
  kind: 'test-pattern',
  order: 7,
  create: parent => {
    const view = new TestPatternView(parent);
    return {
      render: (_layers, frame) =>
        view.show(frame?.screen, frame?.testPattern === true),
      rescale: scale => view.rescale(scale),
      dispose: () => view.dispose(),
    };
  },
});
