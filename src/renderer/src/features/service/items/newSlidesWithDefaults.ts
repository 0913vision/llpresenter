import {newSlidesItem, type SlidesItem} from '@core/services/slidesEdits';
import {defaultSlideTransitions} from '@core/schema/preferences';

/** Reads the current preparation defaults when a slide item is created. */
export async function newSlidesWithDefaults(
  form: SlidesItem['slides']['form'],
  id: SlidesItem['id'],
): Promise<SlidesItem> {
  const preferences = await window.llp?.preferences.get();
  return newSlidesItem(
    form,
    id,
    (preferences?.show.slideDefaults ?? defaultSlideTransitions)[form],
  );
}
