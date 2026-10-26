import type {MessageLayer, PropLayer} from '@shared/live';
import type {OverlayClear} from '@shared/schema/overlayClear';
import {withLayers, type LiveHistory} from './history';
import {messageLayer} from './messageState';
import {propLayer} from './propState';

function withoutMessage(
  layer: MessageLayer | null,
  id: string,
): MessageLayer | null {
  if (layer === null) return layer;
  if (layer.items === undefined) return layer.messageId === id ? null : layer;
  const items = layer.items.filter(item => item.messageId !== id);
  return items.length === layer.items.length ? layer : messageLayer(items);
}
function withoutProp(layer: PropLayer | null, id: string): PropLayer | null {
  if (layer === null) return layer;
  if (layer.items === undefined) return layer.propId === id ? null : layer;
  const items = layer.items.filter(item => item.propId !== id);
  return items.length === layer.items.length ? layer : propLayer(items);
}

export function clearOverlay(
  history: LiveHistory,
  target: OverlayClear['target'],
  now: number,
): LiveHistory {
  const layers = history.state.layers;
  if (target.kind === 'stage-message') {
    const text = history.state.stageMessage;
    if (text == null) return history;
    const cleared = withLayers(history, layers, {
      layers,
      clearedAt: now,
      stageMessage: text,
    });
    return {...cleared, state: {...cleared.state, stageMessage: null}};
  }
  const next =
    target.kind === 'message'
      ? {...layers, message: withoutMessage(layers.message, target.messageId)}
      : {...layers, prop: withoutProp(layers.prop, target.propId)};
  if (next.message === layers.message && next.prop === layers.prop) {
    return history;
  }
  return withLayers(history, next, {
    layers,
    clearedAt: now,
    ...(target.kind === 'message' ? {clearedMessageId: target.messageId} : {}),
  });
}
