import type {AppLayout} from '@shared/schema/appConfig';
import type {LayoutChange} from '@shared/schema/uiState';

/**
 * The layout with a change merged into its size class. A change only sets the
 * fields it carries, so the other fields of the size class, and the other size
 * classes, stay as they are.
 */
export function withLayoutChange(
  layout: AppLayout | undefined,
  {sizeClass, left, right, thumbnailScalePercent}: LayoutChange,
): AppLayout {
  const current = layout ?? {};
  const merged = {
    ...current[sizeClass],
    ...(left === undefined ? {} : {left}),
    ...(right === undefined ? {} : {right}),
    ...(thumbnailScalePercent === undefined ? {} : {thumbnailScalePercent}),
  };
  return {...current, [sizeClass]: merged};
}
