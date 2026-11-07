import type {AppLayout} from '@core/schema/appConfig';
import type {LayoutChange} from '@core/schema/uiState';

/**
 * The layout with a change merged into its size class. A change sets only the
 * fields it carries, whichever the contract allows, so the other fields of the
 * size class, and the other size classes, stay as they are.
 */
export function withLayoutChange(
  layout: AppLayout | undefined,
  {sizeClass, rows, ...fields}: LayoutChange,
): AppLayout {
  const current = layout ?? {};
  const previous = current[sizeClass];
  return {
    ...current,
    [sizeClass]: {
      ...previous,
      ...fields,
      ...(rows === undefined ? {} : {rows: {...previous?.rows, ...rows}}),
    },
  };
}
