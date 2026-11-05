import type {ServiceItemOf} from '../schema/service';
import type {Screen} from '../schema/screens';
import type {Theme} from '../schema/themes';
import type {ThemeElementKind} from './elementRules';
import {resolveThemeScreen} from './resolve';

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
    const kinds = [...required].filter(
      kind => !layout.elements.some(element => element.kind === kind),
    );
    return kinds.length === 0 ? [] : [{screen, kinds}];
  });
}
