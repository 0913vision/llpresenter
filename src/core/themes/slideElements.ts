import type {ServiceItemOf} from '../schema/service';
import type {Screen} from '../schema/screens';
import type {Theme} from '../schema/themes';
import type {ThemeElementKind} from './elementRules';
import {resolveThemeScreen} from './resolve';
import {AD_THEME_ID} from './defaults';

/** Lists content that cannot appear because the selected theme lacks its element. */
export function missingSlideElements(
  item: ServiceItemOf<'slides'>,
  theme: Theme,
  screens: readonly Screen[],
): ReadonlyArray<{
  readonly screen: Screen;
  readonly kinds: readonly ThemeElementKind[];
}> {
  const required = new Set<ThemeElementKind>();
  for (const slide of item.slides.slides) {
    if ('verse' in slide) continue;
    if ('media' in slide) required.add('media');
    if ('text' in slide && slide.text !== '') {
      required.add('currentText');
    }
    if ('name' in slide && slide.name !== '') {
      required.add('slideName');
    }
  }
  return screens.flatMap(screen => {
    const {layout} = resolveThemeScreen(theme, screen.id, screens);
    // NOTE(0913vision): The built-in ad theme intentionally leaves broadcast
    // empty; that screen does not promise to show advertisement content.
    if (
      theme.id === AD_THEME_ID &&
      screen.kind === 'broadcast' &&
      layout.elements.length === 0
    ) {
      return [];
    }
    const kinds = [...required].filter(
      kind => !layout.elements.some(element => element.kind === kind),
    );
    return kinds.length === 0 ? [] : [{screen, kinds}];
  });
}
