import {createServiceItemId, createSlideId} from '@core/schema/ids';
import type {ServiceItemOf} from '@core/schema/service';
import {createDefaultThemes} from '@core/themes/defaults';
import {
  SECTION_THEME_ID,
  type SundaySection,
} from '@core/themes/sundaySections';

export async function prepareSection(
  section: SundaySection,
): Promise<ServiceItemOf<'slides'>> {
  const api = window.llp;
  if (api === undefined) throw new Error('App API unavailable');
  const pictures = await api.media.edit({type: 'media.sections.prepare'});
  if (!pictures.ok) throw new Error('Could not prepare section pictures');
  const themes = await api.settings.get({name: 'themes'});
  if (themes.name !== 'themes') throw new Error('Section themes unavailable');
  if (!themes.value.themes.some(theme => theme.id === SECTION_THEME_ID)) {
    const screens = await api.settings.get({name: 'screens'});
    if (screens.name !== 'screens') {
      throw new Error('Section screens unavailable');
    }
    const theme = createDefaultThemes(screens.value.screens).themes.find(
      theme => theme.id === SECTION_THEME_ID,
    );
    if (theme === undefined) throw new Error('Section theme unavailable');
    const result = await api.settings.edit({
      type: 'settings.update',
      name: 'themes',
      baseRevision: themes.revision,
      value: {...themes.value, themes: [...themes.value.themes, theme]},
    });
    if (!result.ok) throw new Error('Could not add the section theme');
  }
  return {
    id: createServiceItemId(crypto.randomUUID()),
    theme: SECTION_THEME_ID,
    background: section.background,
    slides: {
      form: 'blank',
      name: section.name,
      slides: [{id: createSlideId(crypto.randomUUID()), text: section.english}],
    },
  };
}
