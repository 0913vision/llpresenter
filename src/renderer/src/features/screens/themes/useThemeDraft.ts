import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {Result} from '@core/common/result';
import {sameJson} from '@core/common/sameJson';
import {checkPart} from '@core/schema/fileFormat';
import {createThemeId, type ThemeId} from '@core/schema/ids';
import {themeFileSchema, type ThemeFile} from '@core/schema/theme';
import type {Themes} from '@core/schema/themes';
import {
  editThemeList,
  type ThemeListProblem,
  type ThemeListResult,
} from '@core/theme/list';
import {INVALID_CHANGE, themeProblems} from './themeNames';

interface DraftOptions {
  readonly saved: Themes | null;
  readonly reason: string | undefined;
  readonly write: (
    transform: (list: Themes) => ThemeListResult,
    completion: 'saved',
  ) => Promise<Result<boolean, ThemeListProblem>>;
  readonly report: (title: string) => void;
}

/** The most unsaved edits the working copy can step back through. */
export const THEME_HISTORY_LIMIT = 100;

type Step =
  | {readonly kind: 'draft'; readonly value: ThemeFile | null}
  | {readonly kind: 'saved'; readonly before: Themes; readonly after: Themes};

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
  const past = useRef<Step[]>([]);
  const future = useRef<Step[]>([]);
  const group = useRef<{changed: boolean} | null>(null);
  const stepping = useRef(false);

  const beginEditGroup = (): (() => void) => {
    const current = {changed: false};
    group.current = current;
    return () => {
      if (group.current === current) group.current = null;
    };
  };
  const keep = (next: ThemeFile | null): void => {
    draftRef.current = next;
    setDraft(next);
  };
  const remember = (step: Step): void => {
    past.current = [...past.current, step].slice(-THEME_HISTORY_LIMIT);
    future.current = [];
  };
  const forget = (): void => {
    group.current = null;
    past.current = [];
    future.current = [];
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
    if (group.current?.changed !== true) {
      remember({kind: 'draft', value: before});
    }
    if (group.current !== null) group.current.changed = true;
    future.current = [];
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
    remember({kind: 'saved', before, after});
    setHistoryVersion(value => value + 1);
  };

  const step = (
    from: typeof past,
    to: typeof past,
    direction: 'undo' | 'redo',
  ): void => {
    group.current = null;
    const entry = from.current.at(-1);
    if (reason !== undefined || stepping.current || entry === undefined) return;
    if (entry.kind === 'draft') {
      from.current.pop();
      to.current.push({kind: 'draft', value: draftRef.current});
      keep(entry.value);
      return;
    }
    const expected = direction === 'undo' ? entry.after : entry.before;
    const replacement = direction === 'undo' ? entry.before : entry.after;
    stepping.current = true;
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
        if (result.value && from.current.at(-1) === entry) {
          from.current.pop();
          to.current.push(entry);
        }
      })
      .catch(() => report('테마 변경 실패'))
      .finally(() => {
        stepping.current = false;
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
    forget();
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
    beginEditGroup,
    recordSaved,
    save,
    saveAs,
    undo: (): void => step(past, future, 'undo'),
    redo: (): void => step(future, past, 'redo'),
    canUndo: (): boolean => !stepping.current && past.current.length > 0,
    canRedo: (): boolean => !stepping.current && future.current.length > 0,
    discard: (): void => {
      forget();
      keep(null);
    },
  };
}
