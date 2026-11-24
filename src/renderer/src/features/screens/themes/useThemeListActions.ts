import {useEffect, useRef} from 'react';
import {limitReason} from '@core/common/limitReason';
import {createThemeId, type ThemeId} from '@core/schema/ids';
import type {SlidePurpose, ThemeFile} from '@core/schema/theme';
import {THEMES_LIMITS} from '@core/schema/themes';
import {
  builtInTheme,
  copiedThemeName,
  editThemeList,
  newTheme,
  ownThemeCount,
  themeFor,
  type ThemeListEdit,
} from '@core/theme';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {deleteSelection} from '@renderer/ui/lists/deleteSelection';
import {useAlive} from '@renderer/ui/useAlive';
import {themeProblems} from './themeNames';
import type {ThemeModel} from './useThemeEditor';

function newId(): ThemeId {
  return createThemeId(crypto.randomUUID());
}

/**
 * The edits of the 테마 list: add, copy, move, rename, delete, make default,
 * and restore. A new theme or copy is chosen and its row takes the focus.
 */
export function useThemeListActions(model: ThemeModel) {
  const {list, reason} = model;
  const alive = useAlive();
  const focusCreated = useRef<ThemeId | null>(null);
  useEffect(() => {
    const id = focusCreated.current;
    if (id === null) return;
    const row = document.querySelector<HTMLElement>(
      `[role="listbox"][aria-label="테마"] [role="option"][data-value="${id}"]`,
    );
    if (row !== null) {
      row.focus({preventScroll: true});
      focusCreated.current = null;
    }
  }, [model.theme?.id]);

  const execute = async (edit: ThemeListEdit): Promise<boolean> => {
    const unchanged = model.guardInteraction();
    const result = await model.change(
      value => editThemeList(value, edit),
      edit.kind === 'rename' ? 'saved' : 'applied',
    );
    if (!alive.current) return false;
    if (!result.ok) {
      model.report(themeProblems[result.error]);
      return false;
    }
    if (result.value && edit.kind === 'add' && unchanged()) {
      model.chooseTheme(edit.theme.id);
      focusCreated.current = edit.theme.id;
    }
    return result.value;
  };
  const run = (edit: ThemeListEdit): void => {
    execute(edit).catch(model.reportError);
  };

  const full = list !== null && ownThemeCount(list) >= THEMES_LIMITS.themes;
  /** Why no theme can be added now, if it cannot. */
  const addReason =
    reason ?? (full ? limitReason('테마', THEMES_LIMITS.themes) : undefined);

  const duplicate = (theme: ThemeFile): void => {
    if (list === null) return;
    run({
      kind: 'add',
      theme: {...theme, id: newId(), name: copiedThemeName(list, theme.name)},
      after: theme.id,
    });
  };
  useWindowShortcuts([
    {
      id: 'edit.duplicate',
      when: event =>
        event.target instanceof Element &&
        event.target.closest('[role="listbox"][aria-label="테마"]') !== null &&
        model.theme !== undefined,
      unavailable: () => addReason,
      run: () => {
        if (addReason === undefined && model.theme !== undefined) {
          duplicate(model.theme);
        }
      },
    },
  ]);

  return {
    addReason,
    duplicate,
    /** Adds a new theme of a purpose after that purpose's default. */
    add: (purpose: SlidePurpose): void => {
      if (list === null) return;
      run({
        kind: 'add',
        theme: newTheme(list, purpose, newId()),
        after: themeFor(list, purpose).id,
      });
    },
    move: (id: ThemeId, before: ThemeId | null): void =>
      run({kind: 'move', id, before}),
    rename: (id: ThemeId, name: string): Promise<boolean> =>
      execute({kind: 'rename', id, name}),
    /** Asks before deleting a theme of the user's; built-in ones stay. */
    requestDelete: (theme: ThemeFile): void => {
      deleteSelection(
        1,
        () =>
          model.reason === undefined && builtInTheme(theme.id) === undefined,
        () => {
          if (model.dirtyThemeId === theme.id) model.discard();
          run({kind: 'delete', id: theme.id});
        },
      );
    },
    makeDefault: (id: ThemeId): void => run({kind: 'default', id}),
    /** Puts a built-in theme back as it came, dropping unsaved changes. */
    restore: (id: ThemeId): void => {
      if (model.dirtyThemeId === id) model.discard();
      run({kind: 'restore', id});
    },
    isDefault: (theme: ThemeFile): boolean =>
      list !== null && themeFor(list, theme.purpose).id === theme.id,
  };
}
