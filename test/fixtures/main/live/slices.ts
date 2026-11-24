import {registryOf} from '../../../../src/main/live/registry/sliceRegistry';

export const liveSlices = registryOf(
  import.meta.glob<unknown>('./slices/*.ts', {eager: true}),
);
