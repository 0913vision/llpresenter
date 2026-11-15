import {createServiceItemId} from '@core/schema/ids';
import {
  newLiturgyItem,
  type LiturgyKind,
  type LiturgyTranslation,
} from '@core/services/liturgy';
import {builtInTheme} from '@core/themes/defaults';
import {
  CREED_PRAYER_THEME_ID,
  creedPrayerTheme,
} from '@core/themes/creedPrayer';
import {sectionCardOf} from '@core/services/sectionCards';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';

export async function prepareLiturgy(
  kind: LiturgyKind,
  translation: LiturgyTranslation,
) {
  const api = window.llp;
  if (api === undefined) throw new Error('App API unavailable');
  const [themes, screens, preferences] = await Promise.all([
    api.settings.get({name: 'themes'}),
    api.settings.get({name: 'screens'}),
    api.preferences.get(),
  ]);
  if (themes.name !== 'themes' || screens.name !== 'screens') {
    throw new Error('Liturgy settings unavailable');
  }
  if (!themes.value.themes.some(theme => theme.id === CREED_PRAYER_THEME_ID)) {
    const result = await api.settings.edit({
      type: 'settings.update',
      name: 'themes',
      baseRevision: themes.revision,
      value: {
        ...themes.value,
        themes: [
          ...themes.value.themes,
          creedPrayerTheme(
            builtInTheme('bible', screens.value.screens),
            screens.value.screens,
          ),
        ],
      },
    });
    if (!result.ok) throw new Error('Could not add the liturgy theme');
  }
  const section = SUNDAY_SECTIONS.find(entry => entry.name === '사도신경');
  if (section === undefined) throw Error('Missing liturgy section');
  const item = newLiturgyItem(createServiceItemId(crypto.randomUUID()), {
    kind,
    translation,
    transition: preferences.show.slideDefaults[kind],
  });
  const card =
    kind === 'prayer'
      ? {...section, name: '주기도문', english: "The Lord's Prayer"}
      : section;
  return {
    ...item,
    sectionCard: sectionCardOf(card, preferences.show.slideDefaults.section),
  };
}
