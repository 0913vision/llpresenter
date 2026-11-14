import type {Result} from '../common/result';
import {sameJson} from '../common/sameJson';
import type {ThemeId} from '../schema/ids';
import type {Theme, ThemesFile} from '../schema/themes';
import {
  editThemeList,
  findTheme,
  markBuiltInEdited,
  replaceTheme,
  type ThemeEditProblem,
  type ThemeEditResult,
} from './themeEdits';

/** The unsaved screen layouts of one 테마, kept apart from the saved file. */
export interface ThemeDraft {
  readonly themeId: ThemeId;
  readonly screens: Theme['screens'];
  readonly transition?: Theme['transition'];
}

/** The saved file as the editor shows it: the draft layouts replace the saved ones. */
export function withDraft(
  file: ThemesFile,
  draft: ThemeDraft | null,
): ThemesFile {
  const theme = draft === null ? undefined : findTheme(file, draft.themeId);
  if (
    draft === null ||
    theme === undefined ||
    (theme.screens === draft.screens &&
      sameJson(theme.transition, draft.transition))
  ) {
    return file;
  }
  const {transition: _transition, ...rest} = theme;
  return replaceTheme(file, {
    ...rest,
    screens: draft.screens,
    ...(draft.transition === undefined ? {} : {transition: draft.transition}),
  });
}

/**
 * Runs an edit on the shown file and keeps only its effect on the theme's
 * layouts as the new draft. Null means the layouts equal the saved ones.
 */
export function editDraft(
  current: {
    readonly saved: ThemesFile;
    readonly draft: ThemeDraft | null;
    readonly themeId: ThemeId;
  },
  transform: (shown: ThemesFile) => ThemeEditResult,
): Result<ThemeDraft | null, ThemeEditProblem> {
  const {saved, draft, themeId} = current;
  const shown = withDraft(saved, draft?.themeId === themeId ? draft : null);
  const result = transform(shown);
  if (!result.ok) return result;
  const changed = findTheme(result.value, themeId);
  if (changed === undefined) return {ok: false, error: 'missing'};
  const screens = changed.screens;
  const base = findTheme(saved, themeId);
  const transition = changed.transition;
  return {
    ok: true,
    value:
      sameJson(screens, base?.screens) && sameJson(transition, base?.transition)
        ? null
        : {themeId, screens, ...(transition === undefined ? {} : {transition})},
  };
}

/** Writes the draft layouts into the saved theme, which 덮어쓰기 does. */
export function commitDraft(
  saved: ThemesFile,
  draft: ThemeDraft,
): ThemeEditResult {
  const theme = findTheme(saved, draft.themeId);
  if (theme === undefined) return {ok: false, error: 'missing'};
  const shown = findTheme(withDraft(saved, draft), draft.themeId);
  if (shown === undefined) return {ok: false, error: 'missing'};
  return {ok: true, value: replaceTheme(saved, markBuiltInEdited(shown))};
}

/** Adds a new theme made from the draft layouts and leaves the saved one as it was. */
export function saveDraftAs(
  saved: ThemesFile,
  draft: ThemeDraft,
  copy: {readonly id: ThemeId; readonly name: string},
): ThemeEditResult {
  const original = findTheme(saved, draft.themeId);
  if (original === undefined) return {ok: false, error: 'missing'};
  const duplicated = editThemeList(
    withDraft(saved, draft),
    {kind: 'duplicate', id: copy.id, source: draft.themeId},
    new Set(),
  );
  if (!duplicated.ok) return duplicated;
  const renamed = editThemeList(
    duplicated.value,
    {kind: 'rename', id: copy.id, name: copy.name},
    new Set(),
  );
  return renamed.ok
    ? {ok: true, value: replaceTheme(renamed.value, original)}
    : renamed;
}
