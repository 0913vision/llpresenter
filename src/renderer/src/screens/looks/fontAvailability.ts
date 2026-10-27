import type {FontCatalog, FontFamily} from '@shared/schema/fontCatalog';
import type {LooksFile} from '@shared/schema/looks';
import type {Screen} from '@shared/schema/screens';
import type {SelectOption} from '@renderer/ui/SelectMenu';
import type {FontCatalogState} from './useFontCatalog';

const BUNDLED_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const BUNDLED_NAMES = ['pretendard', 'pretendard variable'];
const normalize = (name: string): string => name.trim().toLowerCase();
const namesOf = (family: FontFamily): readonly string[] =>
  [family.family, family.label, ...family.aliases].map(normalize);

/** Matches localized names and aliases without rewriting the saved family. */
export function installedFamily(
  font: string,
  families: FontCatalog,
): FontFamily | undefined {
  return families.find(family => namesOf(family).includes(normalize(font)));
}

/** Shows a fallback warning only after successful native enumeration. */
export function missingFontReason(
  font: string,
  state: FontCatalogState,
): string | undefined {
  if (
    state.status !== 'ready' ||
    BUNDLED_NAMES.includes(normalize(font)) ||
    installedFamily(font, state.families) !== undefined
  ) {
    return undefined;
  }
  return `글꼴이 없어 Pretendard로 표시 중: ${font}`;
}

/** Keeps unsupported saved weights visible while offering the family's real weights. */
export function weightChoices(
  font: string,
  weight: number,
  state: FontCatalogState,
): ReadonlyArray<SelectOption<string>> {
  if (state.status !== 'ready' && !BUNDLED_NAMES.includes(normalize(font))) {
    return [
      {
        value: String(weight),
        label: String(weight),
        disabled: true,
        title:
          state.status === 'loading'
            ? '설치 글꼴을 불러오는 중'
            : '설치 글꼴을 불러올 수 없음',
      },
    ];
  }
  const family =
    state.status === 'ready' && !BUNDLED_NAMES.includes(normalize(font))
      ? installedFamily(font, state.families)
      : undefined;
  const weights = family?.weights ?? BUNDLED_WEIGHTS;
  const supported =
    state.status !== 'ready' ||
    weights.includes(weight) ||
    (family === undefined && weight >= 100 && weight <= 900);
  return [...new Set([...weights, weight])]
    .sort((left, right) => left - right)
    .map(value => ({
      value: String(value),
      label: String(value),
      disabled: value === weight && !supported,
      title: value === weight && !supported ? '이 글꼴에 없는 굵기' : undefined,
    }));
}

/** Marks only Look cards that reference an unavailable audience lyric font. */
export function lookFontWarnings(
  looks: LooksFile | undefined,
  screens: readonly Screen[] | undefined,
  state: FontCatalogState,
): ReadonlyMap<string, string> {
  const warnings = new Map<string, string>();
  if (looks === undefined || state.status !== 'ready') return warnings;
  const available = new Set([
    ...BUNDLED_NAMES,
    ...state.families.flatMap(namesOf),
  ]);
  const missing = new Map(
    looks.lyricStyles
      .filter(style => !available.has(normalize(style.font)))
      .map(style => [
        style.id,
        `글꼴이 없어 Pretendard로 표시 중: ${style.font}`,
      ]),
  );
  const audience = new Set<string>(
    screens
      ?.filter(screen => screen.kind === 'audience')
      .map(screen => screen.id),
  );
  for (const look of looks.looks) {
    const reasons = new Set<string>();
    for (const [screen, card] of Object.entries(look.screens)) {
      if (!audience.has(screen) || card.lyricStyle === undefined) continue;
      const reason = missing.get(card.lyricStyle);
      if (reason !== undefined) reasons.add(reason);
    }
    if (reasons.size > 0) warnings.set(look.id, [...reasons].join('\n'));
  }
  return warnings;
}
