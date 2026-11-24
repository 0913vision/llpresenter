import type {LayerDefinition} from '../layer';
import {TestPatternView} from './testPatternView';

/** The test pattern layer, over everything but the 무대 message. */
export const testPatternLayer: LayerDefinition = {
  kind: 'test-pattern',
  create: (parent, {mode}) => {
    const view = new TestPatternView(parent, mode);
    return {
      render: (_layers, frame) =>
        view.show(frame?.screen, frame?.testPattern === true),
      rescale: scale => view.rescale(scale),
      dispose: () => view.dispose(),
    };
  },
};
