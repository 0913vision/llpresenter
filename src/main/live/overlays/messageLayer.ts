import type {MessageLayer} from '@core/schema/live/live';
import type {ActiveMessage} from '@core/schema/live/overlayState';

export function messageLayer(
  items: readonly ActiveMessage[],
): MessageLayer | null {
  const first = items[0];
  return first === undefined
    ? null
    : {messageId: first.messageId, text: first.text, items};
}
