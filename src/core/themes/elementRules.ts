import type {Screen} from '../schema/screens';

type ScreenKind = Screen['kind'];

export const THEME_LIMITS = {
  themes: 200,
  name: 80,
  screens: 200,
  elements: 10,
  overlays: 50,
  width: 1920,
  height: 1080,
  minimumExtent: 8,
  weight: {min: 100, max: 900},
  fontSize: {min: 12, max: 400},
  lineHeight: {min: 0.8, max: 3},
  tracking: {min: -20, max: 200},
  shortTextCharacters: 10,
  trackingOverrides: 16,
  maxLines: 12,
  radius: 200,
} as const;

export const themeElementKinds = [
  'currentText',
  'reference',
  'nextText',
  'label',
  'nextLabel',
  'media',
  'background',
  'overlay',
  'itemName',
  'slideName',
  'slideNumber',
  'text',
  'image',
  'box',
  'clock',
  'timer',
  'videoTimeLeft',
  'stageMessage',
  'memo',
] as const;
export type ThemeElementKind = (typeof themeElementKinds)[number];

export const themeItemKinds = [
  'song',
  'bible',
  'blank',
  'ad',
  'media',
] as const;
export type ThemeItemKind = (typeof themeItemKinds)[number];

const repeatable = new Set<ThemeElementKind>(['text', 'image', 'box', 'timer']);
const stageOnly = new Set<ThemeElementKind>(['stageMessage', 'memo']);
const fixed = new Set<ThemeElementKind>([
  'text',
  'image',
  'box',
  'clock',
  'timer',
]);

export function canRepeatThemeElement(kind: ThemeElementKind): boolean {
  return repeatable.has(kind);
}

export function isStandbyElement(kind: ThemeElementKind): boolean {
  return fixed.has(kind);
}

export function availableThemeElementKinds(
  elements: ReadonlyArray<{readonly kind: ThemeElementKind}>,
  screenKind: ScreenKind,
  standby: boolean,
): readonly ThemeElementKind[] {
  return themeElementKinds.filter(
    kind =>
      (!standby || isStandbyElement(kind)) &&
      (!stageOnly.has(kind) || screenKind === 'stage') &&
      (canRepeatThemeElement(kind) ||
        !elements.some(element => element.kind === kind)),
  );
}

export type ThemeElementProblem =
  | {readonly reason: 'too-many'}
  | {
      readonly reason: 'duplicate-kind' | 'stage-only';
      readonly kind: ThemeElementKind;
    };

/** Validates a whole canvas; omit screenKind only at the file-schema boundary. */
export function themeElementProblem(
  elements: ReadonlyArray<{readonly kind: ThemeElementKind}>,
  screenKind?: ScreenKind,
): ThemeElementProblem | undefined {
  if (elements.length > THEME_LIMITS.elements) return {reason: 'too-many'};
  const seen = new Set<ThemeElementKind>();
  for (const {kind} of elements) {
    if (
      screenKind !== undefined &&
      screenKind !== 'stage' &&
      stageOnly.has(kind)
    ) {
      return {reason: 'stage-only', kind};
    }
    if (seen.has(kind) && !repeatable.has(kind)) {
      return {reason: 'duplicate-kind', kind};
    }
    seen.add(kind);
  }
  return undefined;
}
