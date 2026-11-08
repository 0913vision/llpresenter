import {createServiceItemId} from '@core/schema/ids';
import {
  newLiturgyItem,
  type LiturgyKind,
  type LiturgyTranslation,
} from '@core/services/liturgy';
import {builtInTheme} from '@core/themes/defaults';
import {
  CREED_PRAYER_THEME_ID,
  creedPrayerLayout,
  creedPrayerTheme,
} from '@core/themes/creedPrayer';
import {
  bibleMeasure,
  createBibleMeasureContext,
} from '@renderer/rendering/bibleMeasure';

export async function prepareLiturgy(
  kind: LiturgyKind,
  translation: LiturgyTranslation,
) {
  const api = window.llp;
  if (api === undefined) throw new Error('App API unavailable');
  await document.fonts.load('700 104px "NanumSquare"');
  const canvas = createBibleMeasureContext();
  const element = creedPrayerLayout().elements.find(
    element => element.kind === 'currentText',
  );
  if (canvas === null || element === undefined) {
    throw new Error('Liturgy measurement unavailable');
  }
  const item = newLiturgyItem(
    createServiceItemId(crypto.randomUUID()),
    {kind, translation},
    bibleMeasure(element, canvas),
  );
  const [themes, screens] = await Promise.all([
    api.settings.get({name: 'themes'}),
    api.settings.get({name: 'screens'}),
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
  return item;
}
