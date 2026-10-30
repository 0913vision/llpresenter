import {messageIdSchema, propIdSchema} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import {clearLayer} from '@renderer/state/clear';
import {sendLive, useLive} from '@renderer/state/live';
import type {DismissDescriptor} from './showingTypes';

export function dismissSlide(): void {
  clearLayer('slide');
}

export function dismissMedia(): void {
  clearLayer('media');
}

/** Dismisses an active message row, or falls back to whole-layer clear for legacy single-item layers. */
export function dismissMessage(messageId: string): void {
  const parsed = parsePayload(messageIdSchema, messageId);
  if (parsed.ok) {
    sendLive({
      type: 'overlay.clear',
      target: {kind: 'message', messageId: parsed.value},
    });
    return;
  }
  const currentMsgLayer = useLive.getState().state?.layers.message;
  const itemCount = currentMsgLayer?.items?.length ?? 0;
  // NOTE(0913vision): Non-UUID ids in multi-item layers are silent no-ops to avoid clearing unrelated items.
  if (itemCount <= 1) {
    clearLayer('message');
  }
}

/** Dismisses an active prop row, or falls back to whole-layer clear for legacy single-item layers. */
export function dismissProp(propId: string): void {
  const parsed = parsePayload(propIdSchema, propId);
  if (parsed.ok) {
    sendLive({
      type: 'overlay.clear',
      target: {kind: 'prop', propId: parsed.value},
    });
    return;
  }
  const currentPropLayer = useLive.getState().state?.layers.prop;
  const itemCount = currentPropLayer?.items?.length ?? 0;
  // NOTE(0913vision): Non-UUID ids in multi-item layers are silent no-ops to avoid clearing unrelated items.
  if (itemCount <= 1) {
    clearLayer('prop');
  }
}

export function dismissNotice(): void {
  clearLayer('notice');
}

export function dismissStageMessage(): void {
  sendLive({
    type: 'overlay.clear',
    target: {kind: 'stage-message'},
  });
}

/** Executes the appropriate clear command for a dismiss descriptor. */
export function executeDismiss(descriptor: DismissDescriptor): void {
  switch (descriptor.kind) {
    case 'slide':
      dismissSlide();
      break;
    case 'media':
      dismissMedia();
      break;
    case 'message':
      dismissMessage(descriptor.messageId);
      break;
    case 'prop':
      dismissProp(descriptor.propId);
      break;
    case 'notice':
      dismissNotice();
      break;
    case 'stage-message':
      dismissStageMessage();
      break;
  }
}
