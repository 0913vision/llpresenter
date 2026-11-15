import {createThemeId, type ThemeId} from '../schema/ids';
import {SERMON_TITLE_THEME_ID} from './sundayScripture';

const replacements = new Map<ThemeId, ThemeId>([
  [
    createThemeId('00000000-0000-4000-8000-000000000107'),
    SERMON_TITLE_THEME_ID,
  ],
]);

/** Retired built-in IDs stay reserved and resolve to their replacement. */
export function retiredThemeReplacement(id: ThemeId): ThemeId | undefined {
  return replacements.get(id);
}
