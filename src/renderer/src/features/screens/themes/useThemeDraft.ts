import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createThemeId, type ThemeId} from '@core/schema/ids';
import type {ThemesFile} from '@core/schema/themes';
import {
  commitDraft,
  editDraft,
  saveDraftAs,
  withDraft,
  type ThemeDraft,
} from '@core/themes/themeDraft';
import {
  findTheme,
  type ThemeEditProblem,
  type ThemeEditResult,
} from '@core/themes/themeEdits';
import {themeProblems} from './themeNames';
import {sameJson} from '@core/common/sameJson';

interface DraftWrites {
  readonly saved: ThemesFile | null;
  readonly reason: string | undefined;
  readonly change: (
    transform: (value: ThemesFile) => ThemeEditResult,
    completion: 'saved',
  ) => Promise<
    | {readonly ok: true; readonly value: boolean}
    | {readonly ok: false; readonly error: ThemeEditProblem}
  >;
  readonly report: (title: string) => void;
}

/** The most unsaved edits the working copy can step back through. */
export const THEME_HISTORY_LIMIT = 100;
type ThemeHistory =
  | {readonly kind: 'draft'; readonly value: ThemeDraft | null}
  | {
      readonly kind: 'saved';
      readonly before: ThemesFile;
      readonly after: ThemesFile;
    };

/**
 * The editor's working copy of one 테마's layouts. Edits change only the
 * copy; 덮어쓰기 and 다른 이름으로 저장 write it.
 */
export function useThemeDraft({saved, reason, change, report}: DraftWrites) {
  const [draft, setDraft] = useState<ThemeDraft | null>(null);
  const [, setHistoryVersion] = useState(0);
  const draftRef = useRef<ThemeDraft | null>(null);
  const savedRef = useRef(saved);
  useLayoutEffect(() => {
    savedRef.current = saved;
  });
  const past = useRef<ThemeHistory[]>([]);
  const future = useRef<ThemeHistory[]>([]);
  const group = useRef<{changed: boolean} | null>(null);
  const stepping = useRef(false);
  const beginEditGroup = (): (() => void) => {
    const current = {changed: false};
    group.current = current;
    return () => {
      if (group.current === current) group.current = null;
    };
  };
  const keep = (next: ThemeDraft | null): void => {
    draftRef.current = next;
    setDraft(next);
  };
  const forget = (): void => {
    group.current = null;
    past.current = [];
    future.current = [];
  };
  const file = useMemo(
    () => (saved === null ? null : withDraft(saved, draft)),
    [saved, draft],
  );
  const dirtyThemeId: ThemeId | null =
    saved !== null &&
    draft !== null &&
    findTheme(saved, draft.themeId) !== undefined
      ? draft.themeId
      : null;

  const edit = (
    themeId: ThemeId,
    transform: (shown: ThemesFile) => ThemeEditResult,
    completed?: (applied: boolean) => void,
  ): void => {
    const base = savedRef.current;
    if (reason !== undefined || base === null) {
      completed?.(false);
      return;
    }
    const result = editDraft(
      {saved: base, draft: draftRef.current, themeId},
      transform,
    );
    if (!result.ok) report(themeProblems[result.error]);
    else {
      if (!group.current?.changed) {
        past.current = [
          ...past.current,
          {kind: 'draft', value: draftRef.current} satisfies ThemeHistory,
        ].slice(-THEME_HISTORY_LIMIT);
      }
      if (group.current !== null) group.current.changed = true;
      future.current = [];
      keep(result.value);
    }
    completed?.(result.ok);
  };

  const recordSaved = (before: ThemesFile, after: ThemesFile): void => {
    past.current = [
      ...past.current,
      {kind: 'saved', before, after} satisfies ThemeHistory,
    ].slice(-THEME_HISTORY_LIMIT);
    future.current = [];
    setHistoryVersion(value => value + 1);
  };
  const step = (
    from: typeof past,
    to: typeof past,
    direction: 'undo' | 'redo',
  ): void => {
    group.current = null;
    if (reason !== undefined || stepping.current || from.current.length === 0) {
      return;
    }
    const entry = from.current.at(-1);
    if (!entry) return;
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
    change(
      value =>
        sameJson(value, expected)
          ? {ok: true, value: replacement}
          : {ok: false, error: 'invalid'},
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
          setHistoryVersion(value => value + 1);
        }
      })
      .catch(() => report('테마 변경 실패'))
      .finally(() => {
        stepping.current = false;
        setHistoryVersion(value => value + 1);
      });
  };
  const undo = (): void => step(past, future, 'undo');
  const redo = (): void => step(future, past, 'redo');

  const commit = async (
    write: (value: ThemesFile) => ThemeEditResult,
  ): Promise<boolean> => {
    const result = await change(write, 'saved');
    if (!result.ok) report(themeProblems[result.error]);
    return result.ok && result.value;
  };

  const save = async (): Promise<boolean> => {
    const current = draftRef.current;
    if (current === null) return true;
    const written = await commit(value => commitDraft(value, current));
    if (written && draftRef.current === current) {
      forget();
      keep(null);
    }
    return written;
  };

  const saveAs = async (
    themeId: ThemeId,
    name: string,
  ): Promise<ThemeId | undefined> => {
    const base = savedRef.current;
    const original = base === null ? undefined : findTheme(base, themeId);
    if (original === undefined) return undefined;
    const current =
      draftRef.current?.themeId === themeId
        ? draftRef.current
        : {
            themeId,
            screens: original.screens,
          };
    const copy = {id: createThemeId(crypto.randomUUID()), name};
    const written = await commit(value => saveDraftAs(value, current, copy));
    if (!written) return undefined;
    if (draftRef.current === current) {
      forget();
      keep(null);
    }
    return copy.id;
  };

  return {
    file,
    dirtyThemeId,
    hasDraft: (): boolean => draftRef.current !== null,
    edit,
    beginEditGroup,
    recordSaved,
    save,
    saveAs,
    undo,
    redo,
    canUndo: (): boolean => !stepping.current && past.current.length > 0,
    canRedo: (): boolean => !stepping.current && future.current.length > 0,
    discard: () => {
      forget();
      keep(null);
    },
  };
}
