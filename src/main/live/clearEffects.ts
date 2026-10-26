import {layerKinds, type LiveState} from '@shared/live';
import {
  MAX_CLEAR_EFFECTS,
  type ClearEffect,
  type ClearFade,
} from '@shared/schema/clearFade';
import type {PropId} from '@shared/schema/ids';
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
  timing: {
    readonly transition: ClearFade | undefined;
    readonly now: number;
    readonly propId?: PropId;
  },
): LiveHistory {
  if (after === before) return after;
  const {transition, now, propId} = timing;
  const added: ClearEffect[] = [];
  if (transition?.fade && transition.durationMs > 0) {
    const stamp = {since: now, durationMs: transition.durationMs};
    const targets: Array<ClearEffect['target']> =
      propId === undefined
        ? layerKinds
            .filter(
              layer =>
                before.state.layers[layer] !== null &&
                after.state.layers[layer] === null,
            )
            .map(layer => ({kind: 'layer', layer}))
        : [{kind: 'prop', propId}];
    added.push(...targets.map(target => ({target, ...stamp})));
  }
  const clearedProps =
    propId === undefined &&
    before.state.layers.prop !== null &&
    after.state.layers.prop === null;
  const kept = (after.state.clearEffects ?? []).filter(
    effect =>
      now < effect.since + effect.durationMs &&
      (!clearedProps || effect.target.kind !== 'prop'),
  );
  if (added.length === 0 && after.state.clearEffects === undefined) {
    return after;
  }
  return {
    ...after,
    state: {
      ...after.state,
      clearEffects: [...kept, ...added].slice(-MAX_CLEAR_EFFECTS),
    },
  };
}
