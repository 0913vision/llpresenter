import type {ActiveMessage, MessageLayer} from '@shared/live';

export function messageLayer(
  items: readonly ActiveMessage[],
): MessageLayer | null {
  const first = items[0];
  return first === undefined
    ? null
    : {messageId: first.messageId, text: first.text, items};
}
