import type {FontFamily} from '@core/schema/fontCatalog';
import {
  installedFamily,
  isBundledFont,
  normalizeFontName,
} from './fontAvailability';
import type {FontCatalogState} from './useFontCatalog';

export interface FontChoice {
  readonly value: string;
  readonly label: string;
  readonly names: readonly string[];
}

const BUNDLED_FONT = 'Pretendard';
const collator = new Intl.Collator('ko', {numeric: true, sensitivity: 'base'});

function choiceOf(family: FontFamily): FontChoice {
  return {
    value: family.family,
    label: family.label,
    names: [family.family, family.label, ...family.aliases].map(
      normalizeFontName,
    ),
  };
}

/** Lists the bundled font first and preserves a restored, unavailable family. */
export function familyChoices(
  font: string,
  state: FontCatalogState,
): {
  readonly selected: string;
  readonly options: readonly FontChoice[];
} {
  const families = state.status === 'ready' ? state.families : [];
  const installed = installedFamily(font, families);
  const selected = isBundledFont(font)
    ? BUNDLED_FONT
    : (installed?.family ?? font);
  const bundled: FontChoice = {
    value: BUNDLED_FONT,
    label: BUNDLED_FONT,
    names: [BUNDLED_FONT, 'Pretendard Variable'].map(normalizeFontName),
  };
  const seen = new Set([normalizeFontName(BUNDLED_FONT)]);
  const available = families
    .filter(family => !isBundledFont(family.family))
    .toSorted((left, right) => collator.compare(left.label, right.label))
    .filter(family => {
      const normalized = normalizeFontName(family.family);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map(choiceOf);
  const restored =
    isBundledFont(font) || installed !== undefined
      ? []
      : [{value: font, label: font, names: [normalizeFontName(font)]}];
  return {selected, options: [bundled, ...available, ...restored]};
}

/** Finds localized labels, canonical names and aliases without creating more rows. */
export function filterFamilies(
  choices: readonly FontChoice[],
  query: string,
): readonly FontChoice[] {
  const term = normalizeFontName(query);
  return term === ''
    ? choices
    : choices.filter(choice => choice.names.some(name => name.includes(term)));
}
