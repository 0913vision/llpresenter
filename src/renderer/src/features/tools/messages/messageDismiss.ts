import {messageIdSchema} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import {clearLayer} from '@renderer/session/clear';
import {sendLive, useLive} from '@renderer/session/live';

/** Clears one message through the existing clear history, including legacy layers. */
export function dismissMessage(messageId: string): void {
  const parsed = parsePayload(messageIdSchema, messageId);
  if (parsed.ok) {
    sendLive({
      type: 'overlay.clear',
      target: {kind: 'message', messageId: parsed.value},
    });
  } else if (
    (useLive.getState().state?.layers.message?.items?.length ?? 0) <= 1
  ) {
    clearLayer('message');
  }
}
