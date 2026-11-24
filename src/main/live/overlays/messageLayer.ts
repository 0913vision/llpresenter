import type {MessageLayer} from '@core/schema/live/live';
import type {ActiveMessage} from '@core/schema/live/overlayState';

/**
 * The message layer of the shown messages, led by the first one, or `null` when
 * none is shown.
 */
export function messageLayer(
  items: readonly ActiveMessage[],
): MessageLayer | null {
  const first = items[0];
  return first === undefined
    ? null
    : {messageId: first.messageId, text: first.text, items};
}
