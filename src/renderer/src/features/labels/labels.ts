import {createContext, use, useMemo, useSyncExternalStore} from 'react';
import type {LabelColor} from '@core/labels';
import type {Label} from '@core/schema/services/labels';
import type {LabelCatalog, LabelCatalogState} from './labelCatalog';

/** The 이름표 of this window; none in a window without the app's data. */
export const Labels = createContext<LabelCatalog | null>(null);

const NO_LABELS: readonly Label[] = [];
const LOADING: LabelCatalogState = {
  labels: null,
  status: 'loading',
  busy: false,
};
const nothing = (): (() => void) => () => undefined;

/** The label catalog of the window, or null where none is provided. */
export function useLabelCatalog(): LabelCatalog | null {
  return use(Labels);
}

/** The labels in their saved order, or none while the file is not read. */
export function useLabels(): readonly Label[] {
  const catalog = use(Labels);
  const state = useSyncExternalStore(
    catalog?.subscribe ?? nothing,
    catalog?.getSnapshot ?? (() => LOADING),
  );
  return state.labels?.value.labels ?? NO_LABELS;
}

/** The color of every label by its name. */
export function useLabelColors(): ReadonlyMap<string, LabelColor> {
  const labels = useLabels();
  return useMemo(
    () => new Map(labels.map(label => [label.name, label.color])),
    [labels],
  );
}
