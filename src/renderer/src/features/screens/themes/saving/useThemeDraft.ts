import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {Result} from '@core/common/result';
import {sameJson} from '@core/common/sameJson';
import {checkPart} from '@core/schema/common/fileFormat';
import {createThemeId, type ThemeId} from '@core/schema/common/ids';
import {themeFileSchema, type ThemeFile} from '@core/schema/screens/theme';
import type {Themes} from '@core/schema/screens/themes';
import {
  editThemeList,
  type ThemeListProblem,
  type ThemeListResult,
} from '@core/theme';
import {INVALID_CHANGE, themeProblems} from '../themeNames';
import {ThemeDraftHistory, type ThemeStepDirection} from './themeDraftHistory';
import {THEME_CHANGE_FAILED} from './useThemeWrites';

interface DraftOptions {
  readonly saved: Themes | null;
  readonly reason: string | undefined;
  readonly write: (
    transform: (list: Themes) => ThemeListResult,
    completion: 'saved',
  ) => Promise<Result<boolean, ThemeListProblem>>;
  readonly report: (title: string) => void;
}

/** The list with the working copy in place; a name is changed in the list. */
function withDraft(list: Themes, draft: ThemeFile | null): Themes {
  return draft === null
    ? list
    : {
        ...list,
        themes: list.themes.map(theme =>
          theme.id === draft.id ? {...draft, name: theme.name} : theme,
        ),
      };
}

function themeIn(list: Themes, id: ThemeId): ThemeFile | undefined {
  return list.themes.find(theme => theme.id === id);
}

/**
 * The working copy of one theme. Edits change only the copy; 저장 and 다른
 * 이름으로 저장 write it.
 */
export function useThemeDraft({saved, reason, write, report}: DraftOptions) {
  const [draft, setDraft] = useState<ThemeFile | null>(null);
  const [, setHistoryVersion] = useState(0);
  const draftRef = useRef<ThemeFile | null>(null);
  const savedRef = useRef(saved);
  useLayoutEffect(() => {
    savedRef.current = saved;
  });
  const [history] = useState(() => new ThemeDraftHistory());

  const keep = (next: ThemeFile | null): void => {
    draftRef.current = next;
    setDraft(next);
  };

  const list = useMemo(
    () => (saved === null ? null : withDraft(saved, draft)),
    [saved, draft],
  );
  const dirtyThemeId: ThemeId | null =
    saved !== null && draft !== null && themeIn(saved, draft.id) !== undefined
      ? draft.id
      : null;

  /** Changes the working copy; undefined refuses the change. */
  const edit = (
    id: ThemeId,
    transform: (theme: ThemeFile) => ThemeFile | undefined,
  ): boolean => {
    const base = savedRef.current;
    if (reason !== undefined || base === null) return false;
    const before = draftRef.current;
    const theme = before?.id === id ? before : themeIn(base, id);
    const changed = theme === undefined ? undefined : transform(theme);
    if (changed === undefined) {
      report(INVALID_CHANGE);
      return false;
    }
    if (changed === theme) return true;
    const checked = checkPart(themeFileSchema, changed);
    if (!checked.ok) {
      report(INVALID_CHANGE);
      return false;
    }
    history.edited(before);
    const original = themeIn(base, id);
    keep(
      original !== undefined &&
        sameJson(original, {...checked.value, name: original.name})
        ? null
        : checked.value,
    );
    return true;
  };

  const recordSaved = (before: Themes, after: Themes): void => {
    history.saved(before, after);
    setHistoryVersion(value => value + 1);
  };

  /**
   * Takes the next step that way: a draft step puts the copy back at once, a
   * save step writes the theme list back as it was.
   */
  const step = (direction: ThemeStepDirection): void => {
    const entry = history.next(direction);
    if (reason !== undefined || history.busy || entry === undefined) return;
    if (entry.kind === 'draft') {
      history.tookDraft(direction, draftRef.current);
      keep(entry.value);
      return;
    }
    const expected = direction === 'undo' ? entry.after : entry.before;
    const replacement = direction === 'undo' ? entry.before : entry.after;
    history.setWriting(true);
    setHistoryVersion(value => value + 1);
    write(
      value =>
        sameJson(value, expected)
          ? {ok: true, value: replacement}
          : {ok: false, error: 'missing'},
      'saved',
    )
      .then(result => {
        if (!result.ok) {
          report(themeProblems[result.error]);
          return;
        }
        if (result.value) history.tookSaved(direction, entry);
      })
      .catch((cause: unknown) => {
        console.error(`Could not ${direction} a theme change`, cause);
        report(THEME_CHANGE_FAILED);
      })
      .finally(() => {
        history.setWriting(false);
        setHistoryVersion(value => value + 1);
      });
  };

  const commit = async (
    transform: (value: Themes) => ThemeListResult,
  ): Promise<boolean> => {
    const result = await write(transform, 'saved');
    if (!result.ok) report(themeProblems[result.error]);
    return result.ok && result.value;
  };

  const settled = (current: ThemeFile | null): void => {
    if (draftRef.current !== current) return;
    history.forget();
    keep(null);
  };

  const save = async (): Promise<boolean> => {
    const current = draftRef.current;
    if (current === null) return true;
    const written = await commit(value => {
      const name = themeIn(value, current.id)?.name ?? current.name;
      return editThemeList(value, {
        kind: 'replace',
        theme: {...current, name},
      });
    });
    if (written) settled(current);
    return written;
  };

  const saveAs = async (
    id: ThemeId,
    name: string,
  ): Promise<ThemeId | undefined> => {
    const base = savedRef.current;
    const current = draftRef.current?.id === id ? draftRef.current : null;
    const theme = current ?? (base === null ? undefined : themeIn(base, id));
    if (theme === undefined) return undefined;
    const copy = createThemeId(crypto.randomUUID());
    const written = await commit(value =>
      editThemeList(value, {
        kind: 'add',
        theme: {...theme, id: copy, name},
        after: id,
      }),
    );
    if (!written) return undefined;
    settled(current);
    return copy;
  };

  return {
    list,
    dirtyThemeId,
    hasDraft: (): boolean => draftRef.current !== null,
    edit,
    beginEditGroup: (): (() => void) => history.beginGroup(),
    recordSaved,
    save,
    saveAs,
    undo: (): void => step('undo'),
    redo: (): void => step('redo'),
    canUndo: (): boolean => history.can('undo'),
    canRedo: (): boolean => history.can('redo'),
    discard: (): void => {
      history.forget();
      keep(null);
    },
  };
}
