import {create} from 'zustand';
import {sizeClasses} from '@core/schema/appConfig';
import type {UiState} from '@core/schema/uiState';
import type {UiApi} from '@contracts/ipc/ui';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {
  clampThumbnailScale,
  commitThumbnailScale,
  DEFAULT_THUMBNAIL_SCALE_PERCENT,
} from '@renderer/ui';

type ScaleBySizeClass = Readonly<Partial<Record<SizeClass, number>>>;
type ScaleField = 'thumbnailScalePercent' | 'detailsSlideScalePercent';
interface ThumbnailScaleView {
  readonly shown: ScaleBySizeClass;
  readonly saved: ScaleBySizeClass;
}

/** Each grid keeps its own renderer state and saved layout field. */
export function createThumbnailScaleStore(field: ScaleField) {
  const state = create<ThumbnailScaleView>(() => ({shown: {}, saved: {}}));
  const use = (sizeClass: SizeClass): number =>
    state(view => view.shown[sizeClass] ?? DEFAULT_THUMBNAIL_SCALE_PERCENT);
  const show = (sizeClass: SizeClass, percent: number): void => {
    state.setState(view => ({
      shown: {...view.shown, [sizeClass]: clampThumbnailScale(percent)},
    }));
  };
  const save = (
    sizeClass: SizeClass,
    percent: number,
    ui: Pick<UiApi, 'setLayout'> | undefined = window.llp?.ui,
  ): void => {
    const whole = commitThumbnailScale(percent);
    show(sizeClass, whole);
    if (
      whole ===
      (state.getState().saved[sizeClass] ?? DEFAULT_THUMBNAIL_SCALE_PERCENT)
    ) {
      return;
    }
    state.setState(view => ({saved: {...view.saved, [sizeClass]: whole}}));
    ui?.setLayout({sizeClass, [field]: whole});
  };
  const seed = (uiState: UiState): void => {
    const saved: Partial<Record<SizeClass, number>> = {};
    for (const sizeClass of sizeClasses) {
      const percent = uiState.layout?.[sizeClass]?.[field];
      if (percent !== undefined) {
        saved[sizeClass] = commitThumbnailScale(percent);
      }
    }
    state.setState({shown: saved, saved});
  };
  return {use, show, save, seed};
}

const showGridScale = createThumbnailScaleStore('thumbnailScalePercent');
export const useThumbnailScale = showGridScale.use;
export const showThumbnailScale = showGridScale.show;
export const saveThumbnailScale = showGridScale.save;
export const seedThumbnailScale = showGridScale.seed;

export const detailsScale = createThumbnailScaleStore(
  'detailsSlideScalePercent',
);
