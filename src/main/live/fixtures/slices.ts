import {registryOf} from '../sliceRegistry';

export const liveSlices = registryOf(
  import.meta.glob<unknown>('./slices/*.ts', {eager: true}),
);
