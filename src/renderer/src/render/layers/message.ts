import {MAX_ACTIVE_MESSAGES} from '@shared/schema/overlayState';
import {defineLayer} from '../layer';
import {OverlayTextView} from '../overlayText';

export const messageLayer = defineLayer({
  kind: 'message',
  order: 4,
  create: parent => {
    const view = new OverlayTextView(parent);
    return {
      render: (layers, frame) => {
        const message = layers.message;
        if (message?.items === undefined) {
          view.show(message?.text ?? null);
          return;
        }
        const id = frame?.screen?.id;
        const item =
          id === undefined
            ? undefined
            : message.items
                .slice(0, MAX_ACTIVE_MESSAGES)
                .findLast(
                  item =>
                    (item.targets === 'all' || item.targets.includes(id)) &&
                    !item.excludedTargets.includes(id),
                );
        view.show(item?.text ?? null);
      },
      rescale: scale => view.rescale(scale),
      dispose: () => view.dispose(),
    };
  },
});
