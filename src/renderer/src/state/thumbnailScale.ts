import {create} from 'zustand';
import {sizeClasses} from '@core/schema/appConfig';
import type {UiState} from '@core/schema/uiState';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {
  clampThumbnailScale,
  commitThumbnailScale,
  DEFAULT_THUMBNAIL_SCALE_PERCENT,
} from '@renderer/ui';

type ScaleBySizeClass = Readonly<Partial<Record<SizeClass, number>>>;

interface ThumbnailScaleView {
  /** The percentage on screen, with fractions while the operator drags. */
  readonly shown: ScaleBySizeClass;
  /** The whole percentage last saved to, or read from, `app.json`. */
  readonly saved: ScaleBySizeClass;
}

const useThumbnailScaleView = create<ThumbnailScaleView>(() => ({
  shown: {},
  saved: {},
}));

function savedScaleOf(sizeClass: SizeClass): number {
  return (
    useThumbnailScaleView.getState().saved[sizeClass] ??
    DEFAULT_THUMBNAIL_SCALE_PERCENT
  );
}

/** The 슬라이드 size of a size class in percent: the chosen one, or 100. */
export function useThumbnailScale(sizeClass: SizeClass): number {
  return useThumbnailScaleView(
    view => view.shown[sizeClass] ?? DEFAULT_THUMBNAIL_SCALE_PERCENT,
  );
}

/** Shows a 슬라이드 size while the operator drags. Saves nothing. */
export function showThumbnailScale(
  sizeClass: SizeClass,
  percent: number,
): void {
  const shown = clampThumbnailScale(percent);
  useThumbnailScaleView.setState(view => ({
    shown: {...view.shown, [sizeClass]: shown},
  }));
}

/**
 * Shows a finished 슬라이드 size as a whole percentage and sends it to the main
 * process, which saves it in `app.json`. A percentage that is already saved is
 * not sent again.
 */
export function saveThumbnailScale(
  sizeClass: SizeClass,
  percent: number,
): void {
  const whole = commitThumbnailScale(percent);
  showThumbnailScale(sizeClass, whole);
  if (whole === savedScaleOf(sizeClass)) return;
  useThumbnailScaleView.setState(view => ({
    saved: {...view.saved, [sizeClass]: whole},
  }));
  window.llp?.ui.setLayout({sizeClass, thumbnailScalePercent: whole});
}

/**
 * Takes the saved 슬라이드 size of every size class from the UI state. Sends
 * nothing. The old `columns` value is a column count, not a size, so it is not
 * read.
 */
export function seedThumbnailScale(uiState: UiState): void {
  const saved: Partial<Record<SizeClass, number>> = {};
  for (const sizeClass of sizeClasses) {
    const percent = uiState.layout?.[sizeClass]?.thumbnailScalePercent;
    if (percent !== undefined) saved[sizeClass] = commitThumbnailScale(percent);
  }
  useThumbnailScaleView.setState({shown: saved, saved});
}
