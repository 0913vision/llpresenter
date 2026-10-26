import {layerKinds, type LayerKind, type LiveLayers} from '@shared/live';
import type {ClearEffect} from '@shared/schema/clearFade';
import {MAX_ACTIVE_PROPS} from '@shared/schema/overlayState';

type LayerOpacity = Partial<Record<LayerKind, number>>;
type PropItem = NonNullable<LiveLayers['prop']>['items'];

/** Retains only outgoing content for bounded clear effects, never an IPC snapshot. */
export class ClearFades {
  private previous: LiveLayers | null = null;
  private propOrder: readonly string[] = [];
  private readonly held = new Map<
    LayerKind,
    NonNullable<LiveLayers[LayerKind]>
  >();
  private readonly props = new Map<
    string,
    {item: NonNullable<PropItem>[number]; index: number}
  >();

  resolve(layers: LiveLayers, effects: readonly ClearEffect[], now: number) {
    const drawn = {...layers};
    const opacity: LayerOpacity = {};
    const propOpacity = new Map<string, number>();
    for (const kind of layerKinds) {
      const effect = effects.find(
        item => item.target.kind === 'layer' && item.target.layer === kind,
      );
      const gain = effect === undefined ? 0 : this.gain(effect, now);
      const previous = this.held.get(kind) ?? this.previous?.[kind];
      if (gain <= 0 || layers[kind] !== null || previous == null) {
        this.held.delete(kind);
      } else {
        this.held.set(kind, previous);
        Object.assign(drawn, {[kind]: previous});
        opacity[kind] = gain;
      }
    }
    const removed = effects.flatMap(effect => {
      if (effect.target.kind !== 'prop') return [];
      const {propId} = effect.target;
      const index = this.propOrder.indexOf(propId);
      const item = this.previous?.prop?.items?.find(
        item => item.propId === propId,
      );
      const value =
        this.props.get(propId) ??
        (item === undefined ? undefined : {item, index});
      const gain = this.gain(effect, now);
      if (
        value === undefined ||
        gain <= 0 ||
        layers.prop?.items?.some(item => item.propId === propId)
      ) {
        return [];
      }
      propOpacity.set(propId, gain);
      return [value];
    });
    this.props.clear();
    const capacity = Math.max(
      0,
      MAX_ACTIVE_PROPS - (layers.prop?.items?.length ?? 0),
    );
    for (const value of removed.slice(0, capacity)) {
      this.props.set(value.item.propId, value);
    }
    if (removed.length > 0 && opacity.prop === undefined) {
      const items = [...(layers.prop?.items ?? [])];
      for (const value of [...this.props.values()].sort(
        (a, b) => a.index - b.index,
      )) {
        items.splice(value.index, 0, value.item);
      }
      const first = items[0];
      if (first !== undefined) drawn.prop = {propId: first.propId, items};
    }
    this.previous = layers;
    this.propOrder = (drawn.prop?.items ?? [])
      .slice(0, MAX_ACTIVE_PROPS)
      .map(item => item.propId);
    return {
      layers: drawn,
      opacity,
      propOpacity,
      active: this.held.size + this.props.size > 0,
    };
  }

  dispose(): void {
    this.previous = null;
    this.propOrder = [];
    this.held.clear();
    this.props.clear();
  }

  private gain(effect: ClearEffect, now: number): number {
    return Math.max(
      0,
      Math.min(1, 1 - (now - effect.since) / effect.durationMs),
    );
  }
}
