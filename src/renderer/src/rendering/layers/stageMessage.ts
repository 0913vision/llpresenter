import {defineLayer} from '../layer';
import {OverlayTextView} from '../overlayText';

export const stageMessageLayer = defineLayer({
  kind: 'stage-message',
  order: 6,
  create: parent => {
    const view = new OverlayTextView(parent);
    return {
      render: (_layers, frame) =>
        view.show(
          frame?.screen?.kind === 'stage' ? (frame.stageMessage ?? null) : null,
        ),
      rescale: scale => view.rescale(scale),
      dispose: () => view.dispose(),
    };
  },
});
