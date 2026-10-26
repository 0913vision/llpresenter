import {layerKinds, type LiveState} from '@shared/live';
import type {ClearEffect, ClearFade} from '@shared/schema/clearFade';
import type {LiveHistory} from './history';

function isCleared(state: LiveState, target: ClearEffect['target']): boolean {
  return target.kind === 'layer'
    ? state.layers[target.layer] === null
    : !state.layers.prop?.items?.some(item => item.propId === target.propId) &&
        state.layers.prop?.propId !== target.propId;
}

/** Drops fade metadata for restored content without retaining cleared payloads. */
export function retainClearEffects(state: LiveState): LiveState {
  const effects = state.clearEffects;
  if (effects === undefined) return state;
  const kept = effects.filter(effect => isCleared(state, effect.target));
  return kept.length === effects.length
    ? state
    : {...state, clearEffects: kept};
}

/** Stamps only the removed layers or props, using main's monotonic clock. */
export function withClearEffects(
  before: LiveHistory,
  after: LiveHistory,
  timing: {readonly transition: ClearFade | undefined; readonly now: number},
): LiveHistory {
  if (after === before) return after;
  const {transition, now} = timing;
  const added: ClearEffect[] = [];
  if (transition?.fade && transition.durationMs > 0) {
    const stamp = {since: now, durationMs: transition.durationMs};
    for (const layer of layerKinds) {
      if (
        before.state.layers[layer] !== null &&
        after.state.layers[layer] === null
      ) {
        added.push({target: {kind: 'layer', layer}, ...stamp});
      }
    }
    if (after.state.layers.prop !== null) {
      const props = after.state.layers.prop;
      const removed = (before.state.layers.prop?.items ?? []).filter(
        item => !props.items?.some(kept => kept.propId === item.propId),
      );
      for (const item of removed) {
        added.push({target: {kind: 'prop', propId: item.propId}, ...stamp});
      }
    }
  }
  const kept = (after.state.clearEffects ?? []).filter(
    effect => now < effect.since + effect.durationMs,
  );
  if (added.length === 0 && after.state.clearEffects === undefined) {
    return after;
  }
  return {...after, state: {...after.state, clearEffects: [...kept, ...added]}};
}
