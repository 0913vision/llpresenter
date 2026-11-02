import {MAX_ACTIVE_MESSAGES} from '@core/schema/overlayState';
import {MESSAGE_BAND} from '@core/screens/messageStyle';
import {defineLayer} from '../layer';
import {MessageBandView} from '../messageBand';
import {OverlayTextView} from '../overlayText';

export const messageLayer = defineLayer({
  kind: 'message',
  order: 4,
  fades: 'message',
  create: parent => {
    const text = new OverlayTextView(parent);
    const band = new MessageBandView(parent, MESSAGE_BAND);
    return {
      render: (layers, frame) => {
        const message = layers.message;
        let shown: string | null;
        if (message?.items === undefined) {
          shown = message?.text ?? null;
        } else {
          const id = frame?.screen?.id;
          shown =
            (id === undefined
              ? undefined
              : message.items
                  .slice(0, MAX_ACTIVE_MESSAGES)
                  .findLast(
                    item =>
                      (item.targets === 'all' || item.targets.includes(id)) &&
                      !item.excludedTargets.includes(id),
                  )
            )?.text ?? null;
        }
        // NOTE(0913vision): Without a frame or a chosen style a 메시지 is
        // drawn in the 기본 band, as the spec says; a saved style draws as text.
        const asBand =
          frame?.messageStyle === undefined || frame.messageBand !== undefined;
        band.setBackground((frame?.messageBand ?? MESSAGE_BAND).background);
        band.show(asBand ? shown : null);
        text.show(asBand ? null : shown, frame?.messageStyle);
      },
      rescale: scale => {
        text.rescale(scale);
        band.rescale(scale);
      },
      dispose: () => {
        text.dispose();
        band.dispose();
      },
    };
  },
});
