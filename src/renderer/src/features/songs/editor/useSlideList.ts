import {useState, useSyncExternalStore} from 'react';
import type {SlideListItem} from '@core/songs/slideListEdits';
import {SlideListModel, type SlideListModelOptions} from './slideListModel';

/** Options initialize one session. Remount or call model.reset when the owner changes documents. */
export function useSlideList<T extends SlideListItem>(
  options: SlideListModelOptions<T>,
) {
  const [model] = useState(() => new SlideListModel(options));
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
  return {state, model};
}
